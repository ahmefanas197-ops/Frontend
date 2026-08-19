import "dotenv/config";

import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";

import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

import pptxgen from "pptxgenjs";
import PDFDocument from "pdfkit";

const app = express();

const upload = multer({
  dest: "uploads/",
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ============================================================
// GEMINI
// ============================================================

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "❌ GEMINI_API_KEY is missing from .env"
  );

  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ============================================================
// CHAT HISTORY
// ============================================================

const chatHistories = {};

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    server: "Gemini AI Backend",
  });
});

// ============================================================
// HISTORY
// ============================================================

app.get(
  "/api/chat/history/:sessionId",
  (req, res) => {
    const { sessionId } = req.params;

    res.json({
      history:
        chatHistories[sessionId] || [],
    });
  }
);

// ============================================================
// NORMAL CHAT + FILES + STREAMING
// ============================================================

app.post(
  ["/api/chat", "/api/chat/stream"],
  upload.single("file"),
  async (req, res) => {
    let temporaryFilePath = null;

    try {
      const {
        message,
        sessionId,
        systemInstruction,
        temperature,
      } = req.body;

      const uploadedFile = req.file;

      if (!sessionId) {
        return res.status(400).json({
          error: "Session ID is required",
        });
      }

      if (!chatHistories[sessionId]) {
        chatHistories[sessionId] = [];
      }

      const userMessage =
        message?.trim() || "";

      // --------------------------------------------------------
      // SAVE USER MESSAGE
      // --------------------------------------------------------

      chatHistories[sessionId].push({
        role: "user",
        content: userMessage,
        file: uploadedFile
          ? uploadedFile.originalname
          : null,
      });

      // --------------------------------------------------------
      // PREVIOUS HISTORY
      // --------------------------------------------------------

      const contents = [];

      const previousMessages =
        chatHistories[sessionId].slice(0, -1);

      for (const item of previousMessages) {
        if (
          item.role === "user" &&
          item.content
        ) {
          contents.push({
            role: "user",
            parts: [
              {
                text: item.content,
              },
            ],
          });
        }

        if (
          item.role === "assistant" &&
          item.content
        ) {
          contents.push({
            role: "model",
            parts: [
              {
                text: item.content,
              },
            ],
          });
        }
      }

      // --------------------------------------------------------
      // CURRENT CONTENT
      // --------------------------------------------------------

      const currentParts = [];

      if (userMessage) {
        currentParts.push(userMessage);
      }

      // --------------------------------------------------------
      // FILE
      // --------------------------------------------------------

      if (uploadedFile) {
        temporaryFilePath =
          uploadedFile.path;

        console.log("");
        console.log(
          `📎 Uploading: ${uploadedFile.originalname}`
        );
        console.log(
          `📄 MIME: ${uploadedFile.mimetype}`
        );

        const geminiFile =
          await ai.files.upload({
            file: temporaryFilePath,
            config: {
              mimeType:
                uploadedFile.mimetype,
              displayName:
                uploadedFile.originalname,
            },
          });

        console.log(
          `✅ Gemini file: ${geminiFile.uri}`
        );

        currentParts.push(
          createPartFromUri(
            geminiFile.uri,
            geminiFile.mimeType ||
              uploadedFile.mimetype
          )
        );
      }

      if (currentParts.length === 0) {
        currentParts.push("Hello");
      }

      contents.push(
        createUserContent(
          currentParts
        )
      );

      // --------------------------------------------------------
      // STREAM HEADERS
      // --------------------------------------------------------

      res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
      );

      res.setHeader(
        "Cache-Control",
        "no-cache"
      );

      res.setHeader(
        "Connection",
        "keep-alive"
      );

      // --------------------------------------------------------
      // GEMINI STREAM
      // --------------------------------------------------------

      console.log(
        "🤖 Sending request to Gemini..."
      );

      const responseStream =
        await ai.models.generateContentStream({
          model:
            "gemini-3.6-flash",

          contents,

          config: {
            systemInstruction:
              systemInstruction ||
              `
You are a helpful AI assistant.

Use clear Markdown formatting.

Use bold headings when appropriate.

Use proper bullet points.

If a file is attached, analyze the actual file.
`,
            temperature:
              temperature !== undefined &&
              temperature !== ""
                ? parseFloat(temperature)
                : 0.7,
          },
        });

      // --------------------------------------------------------
      // STREAM RESPONSE
      // --------------------------------------------------------

      let fullText = "";

      for await (
        const chunk of responseStream
      ) {
        const chunkText = chunk.text;

        if (chunkText) {
          fullText += chunkText;
          res.write(chunkText);
        }
      }

      // --------------------------------------------------------
      // SAVE RESPONSE
      // --------------------------------------------------------

      chatHistories[sessionId].push({
        role: "assistant",
        content: fullText,
      });

      console.log(
        "✅ Gemini response completed."
      );

      res.end();
    } catch (error) {
      console.error(
        "❌ CHAT ERROR:",
        error
      );

      if (!res.headersSent) {
        res.status(500).json({
          error:
            error?.message ||
            "Internal Server Error",
        });
      } else {
        res.end();
      }
    } finally {
      if (temporaryFilePath) {
        try {
          if (
            fs.existsSync(
              temporaryFilePath
            )
          ) {
            fs.unlinkSync(
              temporaryFilePath
            );

            console.log(
              "🗑️ Temporary file deleted."
            );
          }
        } catch (error) {
          console.error(
            "⚠️ Could not delete temporary file:",
            error
          );
        }
      }
    }
  }
);

// ============================================================
// JSON CLEANER
// ============================================================

function cleanJSON(text) {
  let cleaned = String(text || "").trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return cleaned;
}

// ============================================================
// SAFE COLOR
// ============================================================

function hexColor(value, fallback) {
  return String(
    value || fallback
  ).replace("#", "");
}

// ============================================================
// SAFE FILE NAME
// ============================================================

function safeFileName(text) {
  const cleaned =
    String(text || "")
      .replace(
        /[^a-zA-Z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(0, 70);

  return (
    cleaned ||
    "gemini-generated-file"
  );
}

// ============================================================
// CREATE DESIGN SPECIFICATION
// ============================================================

async function createDesignSpec({
  prompt,
  format,
  designStyle,
  systemInstruction,
  temperature,
}) {
  const style =
    designStyle || "professional";

  const isPowerPoint =
    format === "pptx";

  const designPrompt = isPowerPoint
    ? `
You are an expert presentation designer and content strategist.

Create a professional PowerPoint presentation.

USER REQUEST:
${prompt}

DESIGN STYLE:
${style}

Return ONLY valid JSON.

Use EXACTLY this structure:

{
  "title": "Presentation title",
  "subtitle": "Presentation subtitle",
  "theme": {
    "primary": "#0A1422",
    "secondary": "#00A0AA",
    "accent": "#2563EB",
    "background": "#F8FAFC",
    "text": "#0A1422"
  },
  "slides": [
    {
      "layout": "title-content",
      "title": "Slide title",
      "paragraphs": [],
      "bullets": [],
      "stats": [],
      "steps": [],
      "columns": []
    }
  ]
}

Allowed layouts:

cover
title-content
two-column
three-cards
four-cards
timeline
process
statistics
architecture
comparison
quote
closing

Rules:

- 6 to 12 slides.
- The first slide should be the main presentation opening.
- Tell a clear visual story.
- Keep text concise.
- Avoid overcrowding.
- Use cards for grouped ideas.
- Use timelines for processes.
- Use architecture for systems.
- Use statistics for large numbers.
- Use two-column layouts for comparisons.
- Use professional color combinations.
- Keep the same design language across every slide.
- Do not put giant paragraphs on slides.
- Use bullets whenever appropriate.

For cards, use:

"columns": [
  {
    "title": "Card title",
    "paragraphs": [],
    "bullets": []
  }
]

For architecture diagrams, use:

"columns": [
  {
    "title": "Frontend",
    "bullets": ["React", "TypeScript"]
  }
]

For timelines/processes, use:

"steps": [
  {
    "title": "Step 1",
    "description": "..."
  }
]

For statistics, use:

"stats": [
  {
    "value": "95%",
    "label": "..."
  }
]
`
    : `
You are an expert document designer and content strategist.

Create a professional ${format === "pdf" ? "PDF" : "Word"} document.

USER REQUEST:
${prompt}

DESIGN STYLE:
${style}

Return ONLY valid JSON.

Use EXACTLY this structure:

{
  "title": "Document title",
  "subtitle": "Document subtitle",
  "theme": {
    "primary": "#0A1422",
    "secondary": "#00A0AA",
    "accent": "#2563EB"
  },
  "sections": [
    {
      "title": "Section title",
      "layout": "standard",
      "paragraphs": [],
      "bullets": [],
      "callout": ""
    }
  ]
}

Allowed section layouts:

standard
two-column
callout
bullet-focus
summary

Rules:

- Create a complete professional document.
- Use logical sections.
- Use clear hierarchy.
- Keep paragraphs readable.
- Use bullets for lists.
- Use callouts for important points.
- Maintain consistent design language.
`;

  const result =
    await ai.models.generateContent({
      model:
        "gemini-3.6-flash",

      contents: designPrompt,

      config: {
        systemInstruction:
          systemInstruction ||
          `
You are an expert AI content strategist and visual designer.

Think about:
- hierarchy
- whitespace
- readability
- balance
- typography
- visual storytelling
- consistency
- professional design
`,

        temperature:
          temperature !== undefined &&
          temperature !== ""
            ? parseFloat(temperature)
            : 0.5,
      },
    });

  const raw =
    cleanJSON(result.text || "");

  try {
    return JSON.parse(raw);
  } catch {
    const start =
      raw.indexOf("{");

    const end =
      raw.lastIndexOf("}");

    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {
      return JSON.parse(
        raw.slice(
          start,
          end + 1
        )
      );
    }

    throw new Error(
      "Gemini returned invalid design data."
    );
  }
}

// ============================================================
// DOCX GENERATOR
// ============================================================

function createDocx(spec) {
  const children = [];

  const primary =
    hexColor(
      spec.theme?.primary,
      "#0A1422"
    );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text:
            spec.title ||
            "AI Generated Document",
          bold: true,
          size: 38,
          color: primary,
        }),
      ],
      alignment:
        AlignmentType.CENTER,
      spacing: {
        after: 220,
      },
    })
  );

  if (spec.subtitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              spec.subtitle,
            italics: true,
            size: 22,
            color: "64748B",
          }),
        ],
        alignment:
          AlignmentType.CENTER,
        spacing: {
          after: 400,
        },
      })
    );
  }

  for (
    const section of
      spec.sections || []
  ) {
    children.push(
      new Paragraph({
        text:
          section.title ||
          "Section",
        heading:
          HeadingLevel.HEADING_1,
        spacing: {
          before: 260,
          after: 120,
        },
      })
    );

    for (
      const paragraph of
        section.paragraphs || []
    ) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: paragraph,
              size: 22,
            }),
          ],
          spacing: {
            after: 140,
            line: 276,
          },
        })
      );
    }

    for (
      const bullet of
        section.bullets || []
    ) {
      children.push(
        new Paragraph({
          text: bullet,
          bullet: {
            level: 0,
          },
          spacing: {
            after: 90,
          },
        })
      );
    }

    if (
      section.callout
    ) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text:
                section.callout,
              bold: true,
              size: 21,
            }),
          ],
          spacing: {
            before: 120,
            after: 160,
          },
        })
      );
    }
  }

  return new Document({
    creator:
      "Gemini AI Assistant",
    title:
      spec.title ||
      "AI Generated Document",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 850,
              bottom: 850,
              left: 950,
              right: 950,
            },
          },
        },
        children,
      },
    ],
  });
}

// ============================================================
// PPTX GENERATOR
// ============================================================

function createPptx(spec) {
  const pptx =
    new pptxgen();

  pptx.layout =
    "LAYOUT_WIDE";

  pptx.author =
    "Gemini AI Assistant";

  pptx.company =
    "AI Assistant";

  pptx.title =
    spec.title ||
    "AI Generated Presentation";

  pptx.subject =
    "AI generated presentation";

  pptx.lang = "en-US";

  pptx.theme = {
    headFontFace:
      "Aptos Display",
    bodyFontFace:
      "Aptos",
    lang: "en-US",
  };

  const theme =
    spec.theme || {};

  const primary =
    hexColor(
      theme.primary,
      "#0A1422"
    );

  const secondary =
    hexColor(
      theme.secondary,
      "#00A0AA"
    );

  const accent =
    hexColor(
      theme.accent,
      "#2563EB"
    );

  const background =
    hexColor(
      theme.background,
      "#F8FAFC"
    );

  const text =
    hexColor(
      theme.text,
      "#0A1422"
    );

  // ------------------------------------------------------------
  // COVER
  // ------------------------------------------------------------

  const cover =
    pptx.addSlide();

  cover.background = {
    color: primary,
  };

  cover.addShape(
    pptx.ShapeType.rect,
    {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.08,
      fill: {
        color: secondary,
      },
      line: {
        color: secondary,
      },
    }
  );

  cover.addShape(
    pptx.ShapeType.rect,
    {
      x: 9.1,
      y: 0,
      w: 4.233,
      h: 7.5,
      fill: {
        color: "10273B",
      },
      line: {
        color: "10273B",
      },
    }
  );

  cover.addText(
    spec.title ||
      "AI Generated Presentation",
    {
      x: 0.75,
      y: 1.4,
      w: 7.8,
      h: 1.5,
      fontFace:
        "Aptos Display",
      fontSize: 36,
      bold: true,
      color: "FFFFFF",
      margin: 0,
      fit: "shrink",
    }
  );

  if (spec.subtitle) {
    cover.addText(
      spec.subtitle,
      {
        x: 0.78,
        y: 3.2,
        w: 7.0,
        h: 0.8,
        fontFace:
          "Aptos",
        fontSize: 17,
        color: "B6C3D0",
        margin: 0,
        fit: "shrink",
      }
    );
  }

  cover.addText(
    "Generated with Gemini AI",
    {
      x: 0.78,
      y: 5.9,
      w: 3.5,
      h: 0.3,
      fontFace:
        "Aptos",
      fontSize: 10,
      bold: true,
      color: secondary,
      margin: 0,
    }
  );

  for (
    let i = 0;
    i < 5;
    i++
  ) {
    cover.addShape(
      pptx.ShapeType.arc,
      {
        x:
          9.35 +
          i * 0.35,
        y:
          1 +
          i * 0.55,
        w: 2.2,
        h: 2.2,
        line: {
          color:
            secondary,
          transparency:
            40 + i * 8,
          width: 1.5,
        },
        fill: {
          color:
            primary,
          transparency: 100,
        },
      }
    );
  }

  // ------------------------------------------------------------
  // SLIDES
  // ------------------------------------------------------------

  const slides =
    spec.slides || [];

  slides.forEach(
    (item, index) => {
      const slide =
        pptx.addSlide();

      slide.background = {
        color: background,
      };

      slide.addShape(
        pptx.ShapeType.rect,
        {
          x: 0,
          y: 0,
          w: 13.333,
          h: 0.08,
          fill: {
            color:
              secondary,
          },
          line: {
            color:
              secondary,
          },
        }
      );

      slide.addText(
        String(index + 2).padStart(
          2,
          "0"
        ),
        {
          x: 12.15,
          y: 0.3,
          w: 0.55,
          h: 0.25,
          fontSize: 9,
          bold: true,
          color:
            secondary,
          align:
            "right",
          margin: 0,
        }
      );

      slide.addText(
        item.title ||
          `Slide ${index + 1}`,
        {
          x: 0.7,
          y: 0.65,
          w: 10.8,
          h: 0.6,
          fontFace:
            "Aptos Display",
          fontSize: 27,
          bold: true,
          color: text,
          margin: 0,
          fit: "shrink",
        }
      );

      const layout =
        item.layout ||
        "title-content";

      // ========================================================
      // CARDS
      // ========================================================

      if (
        layout ===
          "three-cards" ||
        layout ===
          "four-cards"
      ) {
        const columns =
          item.columns ||
          [];

        const count =
          layout ===
          "four-cards"
            ? 4
            : 3;

        const width =
          11.7 / count;

        for (
          let i = 0;
          i <
            Math.min(
              count,
              columns.length
            );
          i++
        ) {
          const col =
            columns[i];

          const x =
            0.7 +
            i * width;

          slide.addShape(
            pptx.ShapeType.roundRect,
            {
              x,
              y: 1.7,
              w:
                width - 0.22,
              h: 3.5,
              fill: {
                color:
                  "FFFFFF",
              },
              line: {
                color:
                  "D9E2EC",
                width: 1,
              },
            }
          );

          slide.addShape(
            pptx.ShapeType.rect,
            {
              x,
              y: 1.7,
              w:
                width - 0.22,
              h: 0.08,
              fill: {
                color:
                  i % 2 === 0
                    ? secondary
                    : accent,
              },
              line: {
                color:
                  i % 2 === 0
                    ? secondary
                    : accent,
              },
            }
          );

          slide.addText(
            col?.title ||
              `Item ${i + 1}`,
            {
              x:
                x + 0.2,
              y: 2.0,
              w:
                width - 0.55,
              h: 0.45,
              fontSize: 15,
              bold: true,
              color: text,
              margin: 0,
            }
          );

          const body =
            [
              ...(col?.paragraphs ||
                []),
              ...(col?.bullets ||
                []),
            ].join(
              "\n• "
            );

          slide.addText(
            body
              ? `• ${body}`
              : "",
            {
              x:
                x + 0.2,
              y: 2.55,
              w:
                width - 0.55,
              h: 2.1,
              fontSize: 11,
              color:
                "64748B",
              margin: 0.02,
              fit:
                "shrink",
            }
          );
        }

        return;
      }

      // ========================================================
      // TWO COLUMN
      // ========================================================

      if (
        layout ===
        "two-column"
      ) {
        const columns =
          item.columns ||
          [];

        for (
          let i = 0;
          i < 2;
          i++
        ) {
          const col =
            columns[i] ||
            {};

          const x =
            i === 0
              ? 0.75
              : 6.85;

          slide.addShape(
            pptx.ShapeType.roundRect,
            {
              x,
              y: 1.7,
              w: 5.65,
              h: 4.5,
              fill: {
                color:
                  "FFFFFF",
              },
              line: {
                color:
                  "D9E2EC",
              },
            }
          );

          slide.addText(
            col.title ||
              (i === 0
                ? "Overview"
                : "Details"),
            {
              x:
                x + 0.25,
              y: 2.0,
              w: 4.9,
              h: 0.45,
              fontSize: 17,
              bold: true,
              color: text,
              margin: 0,
            }
          );

          const body =
            [
              ...(col.paragraphs ||
                []),
              ...(col.bullets ||
                []),
            ].join(
              "\n• "
            );

          slide.addText(
            body
              ? `• ${body}`
              : "",
            {
              x:
                x + 0.25,
              y: 2.6,
              w: 5.05,
              h: 3.0,
              fontSize: 12,
              color:
                "64748B",
              margin: 0,
              fit:
                "shrink",
            }
          );
        }

        return;
      }

      // ========================================================
      // STATISTICS
      // ========================================================

      if (
        layout ===
        "statistics"
      ) {
        const stats =
          item.stats ||
          [];

        const width =
          11.7 /
          Math.max(
            stats.length,
            1
          );

        stats.forEach(
          (stat, i) => {
            const x =
              0.7 +
              i * width;

            slide.addShape(
              pptx.ShapeType.roundRect,
              {
                x,
                y: 1.9,
                w:
                  width - 0.25,
                h: 3.2,
                fill: {
                  color:
                    "FFFFFF",
                },
                line: {
                  color:
                    "D9E2EC",
                },
              }
            );

            slide.addText(
              stat.value ||
                "0",
              {
                x:
                  x + 0.15,
                y: 2.35,
                w:
                  width - 0.55,
                h: 0.8,
                fontSize: 32,
                bold: true,
                color:
                  i % 2 === 0
                    ? secondary
                    : accent,
                align:
                  "center",
                margin: 0,
              }
            );

            slide.addText(
              stat.label ||
                "",
              {
                x:
                  x + 0.15,
                y: 3.35,
                w:
                  width - 0.55,
                h: 0.7,
                fontSize: 12,
                color:
                  "64748B",
                align:
                  "center",
                margin: 0,
                fit:
                  "shrink",
              }
            );
          }
        );

        return;
      }

      // ========================================================
      // TIMELINE / PROCESS
      // ========================================================

      if (
        layout === "timeline" ||
        layout === "process"
      ) {
        const steps =
          item.steps ||
          [];

        const count =
          Math.max(
            steps.length,
            1
          );

        const width =
          10.5 / count;

        slide.addShape(
          pptx.ShapeType.line,
          {
            x: 1.0,
            y: 3.05,
            w: 10.4,
            h: 0,
            line: {
              color:
                secondary,
              width: 2,
            },
          }
        );

        steps.forEach(
          (step, i) => {
            const x =
              1.0 +
              i * width;

            slide.addShape(
              pptx.ShapeType.ellipse,
              {
                x,
                y: 2.72,
                w: 0.65,
                h: 0.65,
                fill: {
                  color:
                    i % 2 === 0
                      ? secondary
                      : accent,
                },
                line: {
                  color:
                    "FFFFFF",
                  width: 2,
                },
              }
            );

            slide.addText(
              String(i + 1),
              {
                x,
                y: 2.92,
                w: 0.65,
                h: 0.2,
                fontSize: 11,
                bold: true,
                color:
                  "FFFFFF",
                align:
                  "center",
                margin: 0,
              }
            );

            slide.addText(
              step.title ||
                `Step ${i + 1}`,
              {
                x:
                  x - 0.25,
                y: 3.75,
                w: 2,
                h: 0.4,
                fontSize: 13,
                bold: true,
                color: text,
                align:
                  "center",
                margin: 0,
              }
            );

            slide.addText(
              step.description ||
                "",
              {
                x:
                  x - 0.4,
                y: 4.25,
                w: 2.3,
                h: 0.9,
                fontSize: 9.5,
                color:
                  "64748B",
                align:
                  "center",
                margin: 0,
                fit:
                  "shrink",
              }
            );
          }
        );

        return;
      }

      // ========================================================
      // ARCHITECTURE
      // ========================================================

      if (
        layout ===
        "architecture"
      ) {
        const columns =
          item.columns ||
          [];

        const count =
          Math.min(
            columns.length,
            4
          );

        const width =
          10.8 /
          Math.max(
            count,
            1
          );

        columns.forEach(
          (col, i) => {
            const x =
              1.0 +
              i * width;

            slide.addShape(
              pptx.ShapeType.roundRect,
              {
                x,
                y: 2.1,
                w:
                  width -
                  0.35,
                h: 2.4,
                fill: {
                  color:
                    "FFFFFF",
                },
                line: {
                  color:
                    i % 2 === 0
                      ? secondary
                      : accent,
                  width: 2,
                },
              }
            );

            slide.addText(
              col.title ||
                "",
              {
                x:
                  x + 0.15,
                y: 2.4,
                w:
                  width -
                  0.65,
                h: 0.5,
                fontSize: 15,
                bold: true,
                color: text,
                align:
                  "center",
                margin: 0,
              }
            );

            const body =
              [
                ...(col.bullets ||
                  []),
              ].join(
                "\n• "
              );

            slide.addText(
              body
                ? `• ${body}`
                : "",
              {
                x:
                  x + 0.18,
                y: 3.05,
                w:
                  width -
                  0.7,
                h: 1.15,
                fontSize: 10,
                color:
                  "64748B",
                align:
                  "center",
                margin: 0,
                fit:
                  "shrink",
              }
            );

            if (
              i < count - 1
            ) {
              slide.addShape(
                pptx.ShapeType.chevron,
                {
                  x:
                    x +
                    width -
                    0.25,
                  y: 2.9,
                  w: 0.45,
                  h: 0.45,
                  fill: {
                    color:
                      secondary,
                  },
                  line: {
                    color:
                      secondary,
                  },
                }
              );
            }
          }
        );

        return;
      }

      // ========================================================
      // NORMAL CONTENT
      // ========================================================

      let y = 1.55;

      for (
        const paragraph of
          item.paragraphs ||
          []
      ) {
        slide.addText(
          paragraph,
          {
            x: 0.85,
            y,
            w: 11.2,
            h: 0.8,
            fontSize: 15,
            color:
              "64748B",
            margin: 0,
            fit:
              "shrink",
          }
        );

        y += 0.95;
      }

      if (
        item.bullets &&
        item.bullets.length > 0
      ) {
        const bulletText =
          item.bullets
            .map(
              (b) =>
                `• ${b}`
            )
            .join("\n");

        slide.addText(
          bulletText,
          {
            x: 0.95,
            y,
            w: 11.0,
            h: 4.5,
            fontSize: 16,
            color: text,
            margin: 0,
            fit:
              "shrink",
            breakLine:
              false,
          }
        );
      }
    }
  );

  // ==========================================================
  // CLOSING
  // ==========================================================

  const closing =
    pptx.addSlide();

  closing.background = {
    color: primary,
  };

  closing.addShape(
    pptx.ShapeType.rect,
    {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.08,
      fill: {
        color: secondary,
      },
      line: {
        color: secondary,
      },
    }
  );

  closing.addText(
    "Thank You",
    {
      x: 0.8,
      y: 2.1,
      w: 11.5,
      h: 1,
      fontSize: 38,
      bold: true,
      color: "FFFFFF",
      align: "center",
      margin: 0,
    }
  );

  closing.addText(
    spec.title ||
      "AI Generated Presentation",
    {
      x: 1.2,
      y: 3.2,
      w: 10.7,
      h: 0.6,
      fontSize: 17,
      color: "B6C3D0",
      align: "center",
      margin: 0,
    }
  );

  return pptx;
}

// ============================================================
// PDF GENERATOR
// ============================================================

function createPDF(spec) {
  return new Promise(
    (resolve, reject) => {
      const doc =
        new PDFDocument({
          size: "A4",
          margins: {
            top: 55,
            bottom: 55,
            left: 60,
            right: 60,
          },
          info: {
            Title:
              spec.title ||
              "AI Generated PDF",
            Author:
              "Gemini AI Assistant",
          },
        });

      const chunks = [];

      doc.on(
        "data",
        (chunk) =>
          chunks.push(chunk)
      );

      doc.on(
        "end",
        () =>
          resolve(
            Buffer.concat(
              chunks
            )
          )
      );

      doc.on(
        "error",
        reject
      );

      const primary =
        spec.theme?.primary ||
        "#0A1422";

      const secondary =
        spec.theme?.secondary ||
        "#00A0AA";

      const accent =
        spec.theme?.accent ||
        "#2563EB";

      // --------------------------------------------------------
      // COVER
      // --------------------------------------------------------

      doc
        .fillColor(primary)
        .rect(
          0,
          0,
          doc.page.width,
          180
        )
        .fill();

      doc
        .fillColor("#FFFFFF")
        .font(
          "Helvetica-Bold"
        )
        .fontSize(27)
        .text(
          spec.title ||
            "AI Generated Document",
          60,
          70,
          {
            width:
              doc.page.width -
              120,
            align:
              "center",
          }
        );

      if (spec.subtitle) {
        doc
          .fillColor("#D0D9E2")
          .font(
            "Helvetica-Oblique"
          )
          .fontSize(12)
          .text(
            spec.subtitle,
            70,
            120,
            {
              width:
                doc.page.width -
                140,
              align:
                "center",
            }
          );
      }

      doc.y = 220;

      // --------------------------------------------------------
      // SECTIONS
      // --------------------------------------------------------

      for (
        const section of
          spec.sections || []
      ) {
        if (doc.y > 700) {
          doc.addPage();
        }

        doc
          .fillColor(secondary)
          .font(
            "Helvetica-Bold"
          )
          .fontSize(18)
          .text(
            section.title ||
              "Section"
          );

        doc.moveDown(0.35);

        for (
          const paragraph of
            section.paragraphs ||
            []
        ) {
          doc
            .fillColor(primary)
            .font("Helvetica")
            .fontSize(10.5)
            .text(
              paragraph,
              {
                lineGap: 4,
              }
            );

          doc.moveDown(0.35);
        }

        for (
          const bullet of
            section.bullets ||
            []
        ) {
          doc
            .fillColor(primary)
            .font("Helvetica")
            .fontSize(10.5)
            .text(
              `• ${bullet}`,
              {
                indent: 12,
                lineGap: 3,
              }
            );

          doc.moveDown(0.18);
        }

        if (section.callout) {
          const y = doc.y;

          doc
            .roundedRect(
              60,
              y,
              doc.page.width -
                120,
              55,
              8
            )
            .fill("#EAF1F7");

          doc
            .fillColor(accent)
            .font(
              "Helvetica-Bold"
            )
            .fontSize(10)
            .text(
              section.callout,
              75,
              y + 17,
              {
                width:
                  doc.page.width -
                  150,
              }
            );

          doc.y =
            y + 75;
        }

        doc.moveDown(0.6);
      }

      doc
        .fillColor("#64748B")
        .fontSize(8)
        .text(
          "Generated by Gemini AI Assistant",
          60,
          760,
          {
            width:
              doc.page.width -
              120,
            align:
              "center",
          }
        );

      doc.end();
    }
  );
}

// ============================================================
// GENERATE WORD
// ============================================================

app.post(
  "/api/generate-doc",
  async (req, res) => {
    try {
      const {
        prompt,
        designStyle,
        systemInstruction,
        temperature,
      } = req.body;

      if (!prompt?.trim()) {
        return res.status(400).json({
          error:
            "Please enter a prompt.",
        });
      }

      console.log(
        "📄 Creating designed Word document..."
      );

      const spec =
        await createDesignSpec({
          prompt,
          format: "docx",
          designStyle,
          systemInstruction,
          temperature,
        });

      const document =
        createDocx(spec);

      const buffer =
        await Packer.toBuffer(
          document
        );

      const filename =
        `${safeFileName(
          spec.title
        )}.docx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      res.send(buffer);

      console.log(
        `✅ Word created: ${filename}`
      );
    } catch (error) {
      console.error(
        "❌ Word error:",
        error
      );

      res.status(500).json({
        error:
          error?.message ||
          "Failed to create Word document.",
      });
    }
  }
);

// ============================================================
// GENERATE POWERPOINT
// ============================================================

app.post(
  "/api/generate-pptx",
  async (req, res) => {
    try {
      const {
        prompt,
        designStyle,
        systemInstruction,
        temperature,
      } = req.body;

      if (!prompt?.trim()) {
        return res.status(400).json({
          error:
            "Please enter a prompt.",
        });
      }

      console.log(
        "📊 Creating designed PowerPoint..."
      );

      const spec =
        await createDesignSpec({
          prompt,
          format: "pptx",
          designStyle,
          systemInstruction,
          temperature,
        });

      const pptx =
        createPptx(spec);

      const filename =
        `${safeFileName(
          spec.title
        )}.pptx`;

      const tempPath =
        `uploads/${Date.now()}-${filename}`;

      await pptx.writeFile({
        fileName: tempPath,
      });

      const buffer =
        fs.readFileSync(
          tempPath
        );

      fs.unlinkSync(
        tempPath
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      res.send(buffer);

      console.log(
        `✅ PowerPoint created: ${filename}`
      );
    } catch (error) {
      console.error(
        "❌ PowerPoint error:",
        error
      );

      res.status(500).json({
        error:
          error?.message ||
          "Failed to create PowerPoint.",
      });
    }
  }
);

// ============================================================
// GENERATE PDF
// ============================================================

app.post(
  "/api/generate-pdf",
  async (req, res) => {
    try {
      const {
        prompt,
        designStyle,
        systemInstruction,
        temperature,
      } = req.body;

      if (!prompt?.trim()) {
        return res.status(400).json({
          error:
            "Please enter a prompt.",
        });
      }

      console.log(
        "📕 Creating designed PDF..."
      );

      const spec =
        await createDesignSpec({
          prompt,
          format: "pdf",
          designStyle,
          systemInstruction,
          temperature,
        });

      const buffer =
        await createPDF(spec);

      const filename =
        `${safeFileName(
          spec.title
        )}.pdf`;

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      res.send(buffer);

      console.log(
        `✅ PDF created: ${filename}`
      );
    } catch (error) {
      console.error(
        "❌ PDF error:",
        error
      );

      res.status(500).json({
        error:
          error?.message ||
          "Failed to create PDF.",
      });
    }
  }
);

// ============================================================
// START SERVER
// ============================================================

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      `🚀 Server running on port ${PORT}`
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);
