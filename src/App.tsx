import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Bot,
  Check,
  Copy,
  Moon,
  Plus,
  RefreshCw,
  Send,
  Sliders,
  Sparkles,
  Sun,
  User,
  Wifi,
  WifiOff,
  ArrowDown,
  MessageSquare,
  Trash2,
  Menu,
  X,
  ThumbsUp,
  ThumbsDown,
  Mic,
  MicOff,
  Paperclip,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  reaction?: "like" | "dislike" | null;
  fileName?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike
  extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror:
    | ((
        event: SpeechRecognitionErrorEventLike
      ) => void)
    | null;
  onresult:
    | ((
        event: SpeechRecognitionEventLike
      ) => void)
    | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const API_URL = "http://localhost:5000";

const createSession = (): ChatSession => ({
  id: `session-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`,
  title: "New Conversation",
  messages: [],
});

export default function App() {
  // =========================================================
  // SESSIONS
  // =========================================================

  const [sessions, setSessions] =
    useState<ChatSession[]>([
      {
        id: "session-123",
        title: "New Conversation",
        messages: [],
      },
    ]);

  const [currentSessionId, setCurrentSessionId] =
    useState<string>("session-123");

  // =========================================================
  // CHAT
  // =========================================================

  const [input, setInput] =
    useState("");

  const [attachedFile, setAttachedFile] =
    useState<File | null>(null);

  const [isLoading, setIsLoading] =
    useState(false);

  const [online, setOnline] =
    useState(true);

  const [copiedIndex, setCopiedIndex] =
    useState<number | null>(null);

  const [showScrollBottom, setShowScrollBottom] =
    useState(false);

  // =========================================================
  // UI
  // =========================================================

  const [darkMode, setDarkMode] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  // =========================================================
  // AI SETTINGS
  // =========================================================

  const [systemInstruction, setSystemInstruction] =
    useState(
      "You are a helpful, concise AI assistant."
    );

  const [temperature, setTemperature] =
    useState(0.7);

  // =========================================================
  // VOICE
  // =========================================================

  const [isRecording, setIsRecording] =
    useState(false);

  const [voiceSupported, setVoiceSupported] =
    useState(false);

  const speechRecognitionRef =
    useRef<SpeechRecognitionLike | null>(
      null
    );

  // =========================================================
  // FILE GENERATOR
  // =========================================================

  const [fileGeneratorOpen, setFileGeneratorOpen] =
    useState(false);

  const [isGeneratingFile, setIsGeneratingFile] =
    useState(false);

  const [designStyle, setDesignStyle] =
    useState("professional");

  // =========================================================
  // COMPLAINT
  // =========================================================

  const [complaintOpen, setComplaintOpen] =
    useState(false);

  const [complaintMessageIndex, setComplaintMessageIndex] =
    useState<number | null>(null);

  const [complaintReason, setComplaintReason] =
    useState("");

  const [complaintDetails, setComplaintDetails] =
    useState("");

  // =========================================================
  // REFS
  // =========================================================

  const inputRef =
    useRef<HTMLTextAreaElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const messagesEndRef =
    useRef<HTMLDivElement>(null);

  const chatContainerRef =
    useRef<HTMLDivElement>(null);

  // =========================================================
  // CURRENT SESSION
  // =========================================================

  const currentSession =
    sessions.find(
      (session) =>
        session.id === currentSessionId
    ) || sessions[0];

  const messages =
    currentSession?.messages || [];

  // =========================================================
  // SET MESSAGES
  // =========================================================

  const setMessages = (
    updater:
      | Message[]
      | ((
          previous: Message[]
        ) => Message[])
  ) => {
    setSessions(
      (previousSessions) =>
        previousSessions.map(
          (session) => {
            if (
              session.id !==
              currentSessionId
            ) {
              return session;
            }

            const newMessages =
              typeof updater ===
              "function"
                ? updater(
                    session.messages
                  )
                : updater;

            let title =
              session.title;

            if (
              session.title ===
                "New Conversation" &&
              newMessages.length > 0
            ) {
              const firstUserMessage =
                newMessages.find(
                  (message) =>
                    message.role ===
                    "user"
                );

              if (
                firstUserMessage
              ) {
                const cleanTitle =
                  firstUserMessage.content
                    .replace(
                      /^\[Attached:[^\]]+\]\n?/,
                      ""
                    )
                    .trim();

                if (
                  cleanTitle
                ) {
                  title =
                    cleanTitle.slice(
                      0,
                      30
                    ) +
                    (cleanTitle.length >
                    30
                      ? "..."
                      : "");
                }
              }
            }

            return {
              ...session,
              messages:
                newMessages,
              title,
            };
          }
        )
    );
  };

  // =========================================================
  // CHECK VOICE SUPPORT
  // =========================================================

  useEffect(() => {
    const SpeechAPI =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    setVoiceSupported(
      Boolean(SpeechAPI)
    );
  }, []);

  // =========================================================
  // LOAD HISTORY
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    fetch(
      `${API_URL}/api/chat/history/${currentSessionId}`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Failed to load history"
          );
        }

        return response.json();
      })
      .then((data) => {
        if (
          !cancelled &&
          Array.isArray(
            data.history
          )
        ) {
          setMessages(
            data.history.map(
              (item: any) => ({
                role:
                  item.role ===
                  "model"
                    ? "assistant"
                    : item.role,
                content:
                  item.content ||
                  "",
                fileName:
                  item.file ||
                  undefined,
              })
            )
          );

          setOnline(true);
        }
      })
      .catch((error) => {
        console.error(
          "Failed to load history:",
          error
        );

        setOnline(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentSessionId]);

  // =========================================================
  // AUTO SCROLL
  // =========================================================

  useEffect(() => {
    if (!showScrollBottom) {
      messagesEndRef.current?.scrollIntoView(
        {
          behavior: "smooth",
        }
      );
    }
  }, [
    messages,
    showScrollBottom,
  ]);

  // =========================================================
  // TEXTAREA HEIGHT
  // =========================================================

  useEffect(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.style.height =
      "auto";

    inputRef.current.style.height =
      `${Math.min(
        inputRef.current.scrollHeight,
        180
      )}px`;
  }, [input]);

  // =========================================================
  // SCROLL
  // =========================================================

  const handleScroll = () => {
    if (!chatContainerRef.current) {
      return;
    }

    const {
      scrollTop,
      scrollHeight,
      clientHeight,
    } = chatContainerRef.current;

    setShowScrollBottom(
      scrollHeight -
        scrollTop -
        clientHeight >
        100
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );

    setShowScrollBottom(false);
  };

  // =========================================================
  // NEW CHAT
  // =========================================================

  const createNewChat = () => {
    const newSession =
      createSession();

    setSessions(
      (previous) => [
        newSession,
        ...previous,
      ]
    );

    setCurrentSessionId(
      newSession.id
    );

    setInput("");
    setAttachedFile(null);
    setFileGeneratorOpen(false);
    setSidebarOpen(false);

    if (inputRef.current) {
      inputRef.current.style.height =
        "auto";
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // =========================================================
  // DELETE CHAT
  // =========================================================

  const deleteChat = (
    id: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();

    if (
      sessions.length === 1
    ) {
      const newSession =
        createSession();

      setSessions([
        newSession,
      ]);

      setCurrentSessionId(
        newSession.id
      );

      return;
    }

    const remaining =
      sessions.filter(
        (session) =>
          session.id !== id
      );

    setSessions(remaining);

    if (
      currentSessionId === id
    ) {
      setCurrentSessionId(
        remaining[0].id
      );
    }
  };

  // =========================================================
  // REACTIONS
  // =========================================================

  const handleReaction = (
    index: number,
    reactionType:
      | "like"
      | "dislike"
  ) => {
    setMessages(
      (previous) =>
        previous.map(
          (message, messageIndex) => {
            if (
              messageIndex !==
              index
            ) {
              return message;
            }

            const currentReaction =
              message.reaction;

            return {
              ...message,
              reaction:
                currentReaction ===
                reactionType
                  ? null
                  : reactionType,
            };
          }
        )
    );
  };

  // =========================================================
  // COMPLAINT SIDEBAR
  // =========================================================

  const openComplaint = (
    index: number
  ) => {
    setComplaintMessageIndex(
      index
    );

    setComplaintReason("");
    setComplaintDetails("");
    setComplaintOpen(true);
  };

  const submitComplaint = () => {
    if (
      !complaintReason &&
      !complaintDetails.trim()
    ) {
      return;
    }

    const reportedMessage =
      complaintMessageIndex !==
      null
        ? messages[
            complaintMessageIndex
          ]
        : null;

    console.log(
      "========== AI COMPLAINT =========="
    );

    console.log({
      sessionId:
        currentSessionId,
      messageIndex:
        complaintMessageIndex,
      reason:
        complaintReason,
      details:
        complaintDetails,
      aiResponse:
        reportedMessage?.content,
      timestamp:
        new Date().toISOString(),
    });

    console.log(
      "=================================="
    );

    if (
      complaintMessageIndex !==
      null
    ) {
      setMessages(
        (previous) =>
          previous.map(
            (message, index) =>
              index ===
              complaintMessageIndex
                ? {
                    ...message,
                    reaction:
                      "dislike",
                  }
                : message
          )
      );
    }

    setComplaintOpen(false);
    setComplaintMessageIndex(
      null
    );
    setComplaintReason("");
    setComplaintDetails("");
  };

  // =========================================================
  // REAL VOICE INPUT
  // =========================================================

  const startVoiceRecording =
    () => {
      const SpeechAPI =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

      if (!SpeechAPI) {
        alert(
          "Speech recognition is not supported in this browser. Please use Chrome or Edge."
        );

        return;
      }

      if (isRecording) {
        speechRecognitionRef.current?.stop();
        return;
      }

      const recognition =
        new SpeechAPI();

      speechRecognitionRef.current =
        recognition;

      recognition.continuous =
        true;

      recognition.interimResults =
        true;

      recognition.lang =
        "en-US";

      recognition.onstart =
        () => {
          setIsRecording(true);
        };

      recognition.onresult =
        (event) => {
          let finalText =
            "";

          let interimText =
            "";

          for (
            let i = 0;
            i <
            event.results.length;
            i++
          ) {
            const result =
              event.results[i];

            const transcript =
              result[0]
                ?.transcript ||
              "";

            if (
              result.isFinal
            ) {
              finalText +=
                transcript;
            } else {
              interimText +=
                transcript;
            }
          }

          const currentInput =
            input.trim();

          const speech =
            (
              finalText +
              " " +
              interimText
            ).trim();

          if (speech) {
            setInput(
              currentInput
                ? `${currentInput} ${speech}`
                : speech
            );
          }
        };

      recognition.onerror =
        (event) => {
          console.error(
            "🎤 Speech error:",
            event.error
          );

          setIsRecording(false);

          if (
            event.error ===
            "not-allowed"
          ) {
            alert(
              "Microphone permission was denied. Please allow microphone access in your browser."
            );
          }
        };

      recognition.onend =
        () => {
          setIsRecording(false);
        };

      try {
        recognition.start();
      } catch (error) {
        console.error(
          "Could not start microphone:",
          error
        );

        setIsRecording(false);
      }
    };

  const stopVoiceRecording =
    () => {
      speechRecognitionRef.current?.stop();

      setIsRecording(false);
    };

  // =========================================================
  // GENERATE WORD / PPTX / PDF
  // =========================================================

  const generateAIFile = async (
    type:
      | "docx"
      | "pptx"
      | "pdf"
  ) => {
    if (
      !input.trim() ||
      isGeneratingFile
    ) {
      return;
    }

    try {
      setIsGeneratingFile(
        true
      );

      const endpoint =
        type === "docx"
          ? "generate-doc"
          : type === "pptx"
          ? "generate-pptx"
          : "generate-pdf";

      console.log(
        `📄 Generating ${type.toUpperCase()}...`
      );

      const response =
        await fetch(
          `${API_URL}/api/${endpoint}`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              prompt:
                input.trim(),
              designStyle,
              systemInstruction,
              temperature,
            }),
          }
        );

      if (!response.ok) {
        let errorMessage =
          "File generation failed.";

        try {
          const data =
            await response.json();

          if (data?.error) {
            errorMessage =
              data.error;
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(
          errorMessage
        );
      }

      const blob =
        await response.blob();

      const extension =
        type === "docx"
          ? "docx"
          : type === "pptx"
          ? "pptx"
          : "pdf";

      const contentDisposition =
        response.headers.get(
          "Content-Disposition"
        );

      let filename =
        `Gemini-Generated-${Date.now()}.${extension}`;

      const filenameMatch =
        contentDisposition?.match(
          /filename="([^"]+)"/
        );

      if (
        filenameMatch?.[1]
      ) {
        filename =
          filenameMatch[1];
      }

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download = filename;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

      console.log(
        `✅ ${filename} downloaded.`
      );

      setInput("");
      setFileGeneratorOpen(
        false
      );
    } catch (error) {
      console.error(
        "❌ File generation error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Could not generate the file."
      );
    } finally {
      setIsGeneratingFile(
        false
      );
    }
  };

  // =========================================================
  // SEND MESSAGE
  // =========================================================

  const sendMessage = async () => {
    if (
      (!input.trim() &&
        !attachedFile) ||
      isLoading ||
      isRecording
    ) {
      return;
    }

    const text =
      input.trim();

    const fileToSend =
      attachedFile;

    setInput("");
    setAttachedFile(null);

    setFileGeneratorOpen(
      false
    );

    if (inputRef.current) {
      inputRef.current.style.height =
        "auto";
    }

    const userMessageContent =
      fileToSend
        ? `[Attached: ${fileToSend.name}]${
            text
              ? `\n${text}`
              : ""
          }`
        : text;

    setMessages(
      (previous) => [
        ...previous,
        {
          role: "user",
          content:
            userMessageContent,
          fileName:
            fileToSend?.name,
        },
      ]
    );

    setIsLoading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "message",
        text
      );

      formData.append(
        "sessionId",
        currentSessionId
      );

      formData.append(
        "systemInstruction",
        systemInstruction
      );

      formData.append(
        "temperature",
        temperature.toString()
      );

      if (fileToSend) {
        formData.append(
          "file",
          fileToSend
        );
      }

      console.log(
        "🤖 Sending request to Gemini..."
      );

      if (fileToSend) {
        console.log(
          "📎 Uploading:",
          fileToSend.name
        );

        console.log(
          "📄 MIME:",
          fileToSend.type
        );
      }

      const response =
        await fetch(
          `${API_URL}/api/chat/stream`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      if (!response.body) {
        throw new Error(
          "Server did not return a response body."
        );
      }

      setOnline(true);

      setMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",
            content: "",
          },
        ]
      );

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder(
          "utf-8"
        );

      let fullText = "";

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        const chunk =
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        if (!chunk) {
          continue;
        }

        fullText += chunk;

        setMessages(
          (previous) => {
            const updated = [
              ...previous,
            ];

            if (
              updated.length ===
              0
            ) {
              return updated;
            }

            const lastIndex =
              updated.length - 1;

            updated[
              lastIndex
            ] = {
              ...updated[
                lastIndex
              ],
              content:
                fullText,
            };

            return updated;
          }
        );
      }

      fullText +=
        decoder.decode();

      setMessages(
        (previous) => {
          const updated = [
            ...previous,
          ];

          if (
            updated.length ===
            0
          ) {
            return updated;
          }

          const lastIndex =
            updated.length - 1;

          updated[
            lastIndex
          ] = {
            ...updated[
              lastIndex
            ],
            content:
              fullText,
          };

          return updated;
        }
      );

      console.log(
        "✅ Gemini response completed."
      );
    } catch (error) {
      console.error(
        "❌ Error communicating with server:",
        error
      );

      setOnline(false);

      setMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              `## Connection Error

❌ ${
                error instanceof
                Error
                  ? error.message
                  : "I couldn't connect to the AI server."
              }

Please make sure your backend is running on:

\`http://localhost:5000\``,
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================
  // ENTER TO SEND
  // =========================================================

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  };

  // =========================================================
  // MARKDOWN COMPONENTS
  // =========================================================

  const markdownComponents = {
    h1: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <h1
        className={`mb-4 mt-2 text-2xl font-bold ${
          darkMode
            ? "text-white"
            : "text-slate-900"
        }`}
      >
        {children}
      </h1>
    ),

    h2: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <h2
        className={`mb-3 mt-5 text-xl font-bold ${
          darkMode
            ? "text-white"
            : "text-slate-900"
        }`}
      >
        {children}
      </h2>
    ),

    h3: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <h3
        className={`mb-2 mt-4 text-lg font-semibold ${
          darkMode
            ? "text-white"
            : "text-slate-900"
        }`}
      >
        {children}
      </h3>
    ),

    p: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <p className="mb-3 leading-7">
        {children}
      </p>
    ),

    ul: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <ul className="mb-4 ml-6 list-disc space-y-2">
        {children}
      </ul>
    ),

    ol: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <ol className="mb-4 ml-6 list-decimal space-y-2">
        {children}
      </ol>
    ),

    li: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <li className="pl-1 leading-7">
        {children}
      </li>
    ),

    blockquote: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <blockquote
        className={`my-4 border-l-4 pl-4 italic ${
          darkMode
            ? "border-blue-500 text-slate-300"
            : "border-blue-500 text-slate-600"
        }`}
      >
        {children}
      </blockquote>
    ),

    strong: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <strong className="font-bold">
        {children}
      </strong>
    ),

    code: ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => {
      const isBlock =
        className?.includes(
          "language-"
        );

      const codeString =
        String(children).replace(
          /\n$/,
          ""
        );

      if (isBlock) {
        return (
          <div className="group/code relative my-4">
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  codeString
                )
              }
              className="absolute right-3 top-3 rounded-md bg-white/10 p-1.5 text-xs text-slate-300 opacity-0 transition hover:bg-white/20 group-hover/code:opacity-100"
              title="Copy code"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>

            <pre
              className={`overflow-x-auto rounded-xl p-4 text-sm ${
                darkMode
                  ? "bg-black text-slate-200"
                  : "bg-slate-950 text-white"
              }`}
            >
              <code>
                {children}
              </code>
            </pre>
          </div>
        );
      }

      return (
        <code
          className={`rounded px-1.5 py-0.5 font-mono text-sm ${
            darkMode
              ? "bg-white/10 text-blue-300"
              : "bg-slate-200 text-blue-700"
          }`}
        >
          {children}
        </code>
      );
    },

    a: ({
      children,
      href,
    }: {
      children?: React.ReactNode;
      href?: string;
    }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 underline hover:text-blue-600"
      >
        {children}
      </a>
    ),

    table: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <div className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          {children}
        </table>
      </div>
    ),

    th: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <th
        className={`border px-3 py-2 text-left font-bold ${
          darkMode
            ? "border-white/10 bg-white/5"
            : "border-slate-200 bg-slate-100"
        }`}
      >
        {children}
      </th>
    ),

    td: ({
      children,
    }: {
      children?: React.ReactNode;
    }) => (
      <td
        className={`border px-3 py-2 ${
          darkMode
            ? "border-white/10"
            : "border-slate-200"
        }`}
      >
        {children}
      </td>
    ),
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className={`flex min-h-screen transition-colors duration-300 ${
        darkMode
          ? "bg-[#09090b] text-white"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* =====================================================
          MOBILE SIDEBAR OVERLAY
          ===================================================== */}

      {sidebarOpen && (
        <div
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r transition-transform duration-300 md:static md:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full"
        } ${
          darkMode
            ? "border-white/10 bg-[#0c0c0e]"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-inherit px-4">
          <div className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Chats
          </div>

          <button
            onClick={() =>
              setSidebarOpen(false)
            }
            className="rounded-lg p-1.5 transition hover:bg-white/10 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={
              createNewChat
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {sessions.map(
            (session) => (
              <div
                key={session.id}
                onClick={() => {
                  setCurrentSessionId(
                    session.id
                  );
                  setSidebarOpen(false);
                }}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                  session.id ===
                  currentSessionId
                    ? darkMode
                      ? "bg-white/10 font-medium text-white"
                      : "bg-slate-100 font-medium text-slate-900"
                    : darkMode
                    ? "text-slate-400 hover:bg-white/5 hover:text-white"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />

                  <span className="truncate">
                    {session.title}
                  </span>
                </div>

                <button
                  onClick={(
                    event
                  ) =>
                    deleteChat(
                      session.id,
                      event
                    )
                  }
                  className="rounded-md p-1 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}
        </div>

        <div className="border-t border-inherit p-3">
          <div className="flex items-center gap-2 px-3 py-2 text-xs opacity-60">
            {online ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                Connected to Server
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
                Offline Mode
              </>
            )}
          </div>
        </div>
      </aside>

      {/* =====================================================
          MAIN
          ===================================================== */}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* HEADER */}

        <header
          className={`sticky top-0 z-30 border-b backdrop-blur-md ${
            darkMode
              ? "border-white/10 bg-[#09090b]/80"
              : "border-slate-200 bg-white/80"
          }`}
        >
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setSidebarOpen(
                    true
                  )
                }
                className={`rounded-lg p-2 transition md:hidden ${
                  darkMode
                    ? "hover:bg-white/10"
                    : "hover:bg-slate-100"
                }`}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
                  <Sparkles className="h-4 w-4" />
                </div>

                <div>
                  <h1 className="text-sm font-bold sm:text-base">
                    Gemini AI
                  </h1>

                  <p className="text-[10px] opacity-40">
                    AI Workspace
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSettingsOpen(
                    true
                  )
                }
                className={`rounded-lg p-2 transition ${
                  darkMode
                    ? "hover:bg-white/10"
                    : "hover:bg-slate-100"
                }`}
                title="AI Settings"
              >
                <Sliders className="h-5 w-5" />
              </button>

              <button
                onClick={() =>
                  setDarkMode(
                    !darkMode
                  )
                }
                className={`rounded-lg p-2 transition ${
                  darkMode
                    ? "hover:bg-white/10"
                    : "hover:bg-slate-100"
                }`}
                title="Toggle theme"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ===================================================
            CHAT
            =================================================== */}

        <main className="relative mx-auto flex h-[calc(100vh-64px)] w-full max-w-4xl flex-col px-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600/10">
                <Bot className="h-10 w-10 text-blue-600" />
              </div>

              <h2 className="text-3xl font-bold sm:text-4xl">
                How can I help you?
              </h2>

              <p className="mt-3 max-w-xl text-sm opacity-60">
                Chat, analyze files, or create
                professionally designed Word,
                PowerPoint and PDF files.
              </p>

              <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-2 text-left sm:grid-cols-3">
                {[
                  "Summarize a document",
                  "Analyze an image",
                  "Create a presentation",
                ].map(
                  (suggestion) => (
                    <button
                      key={
                        suggestion
                      }
                      onClick={() =>
                        setInput(
                          suggestion
                        )
                      }
                      className={`rounded-xl border px-4 py-3 text-sm transition ${
                        darkMode
                          ? "border-white/10 bg-white/5 hover:bg-white/10"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div
              ref={
                chatContainerRef
              }
              onScroll={
                handleScroll
              }
              className="relative flex-1 space-y-6 overflow-y-auto py-8 pr-2"
            >
              {messages.map(
                (
                  message,
                  index
                ) => {
                  const isUser =
                    message.role ===
                    "user";

                  return (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        isUser
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {!isUser && (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
                          <Bot className="h-5 w-5" />
                        </div>
                      )}

                      <div
                        className={`group max-w-[88%] rounded-2xl px-4 py-3 ${
                          isUser
                            ? "bg-blue-600 text-white shadow-md"
                            : darkMode
                            ? "bg-white/5"
                            : "border border-slate-100 bg-white shadow-sm"
                        }`}
                      >
                        <div className="mb-2 text-xs opacity-50">
                          {isUser
                            ? "You"
                            : "Gemini AI"}
                        </div>

                        {message.fileName && (
                          <div
                            className={`mb-2 flex items-center gap-2 rounded-lg p-2 text-xs font-medium ${
                              isUser
                                ? "bg-black/20 text-white"
                                : darkMode
                                ? "bg-white/10"
                                : "bg-slate-100"
                            }`}
                          >
                            {message.fileName.match(
                              /\.(jpg|jpeg|png|gif|webp)$/i
                            ) ? (
                              <ImageIcon className="h-4 w-4 shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0" />
                            )}

                            <span className="truncate">
                              {message.fileName}
                            </span>
                          </div>
                        )}

                        <div>
                          {isUser ? (
                            <div className="whitespace-pre-wrap leading-7">
                              {message.content.replace(
                                /^\[Attached:[^\]]+\]\n?/,
                                ""
                              )}
                            </div>
                          ) : (
                            <ReactMarkdown
                              remarkPlugins={[
                                remarkGfm,
                              ]}
                              components={
                                markdownComponents
                              }
                            >
                              {
                                message.content
                              }
                            </ReactMarkdown>
                          )}
                        </div>

                        {!isUser &&
                          message.content && (
                            <div className="mt-3 flex items-center justify-between border-t border-inherit pt-2 opacity-0 transition group-hover:opacity-100">
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    copyMessage(
                                      message.content,
                                      index
                                    )
                                  }
                                  className={`rounded-md p-1.5 transition ${
                                    darkMode
                                      ? "hover:bg-white/10"
                                      : "hover:bg-slate-200"
                                  }`}
                                  title="Copy"
                                >
                                  {copiedIndex ===
                                  index ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>

                                <button
                                  onClick={() =>
                                    setInput(
                                      message.content
                                    )
                                  }
                                  className={`rounded-md p-1.5 transition ${
                                    darkMode
                                      ? "hover:bg-white/10"
                                      : "hover:bg-slate-200"
                                  }`}
                                  title="Use as prompt"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    handleReaction(
                                      index,
                                      "like"
                                    )
                                  }
                                  className={`rounded-md p-1.5 transition ${
                                    message.reaction ===
                                    "like"
                                      ? "text-blue-500"
                                      : "opacity-60 hover:text-blue-500"
                                  }`}
                                  title="Good response"
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (
                                      message.reaction ===
                                      "dislike"
                                    ) {
                                      handleReaction(
                                        index,
                                        "dislike"
                                      );
                                    } else {
                                      handleReaction(
                                        index,
                                        "dislike"
                                      );

                                      openComplaint(
                                        index
                                      );
                                    }
                                  }}
                                  className={`rounded-md p-1.5 transition ${
                                    message.reaction ===
                                    "dislike"
                                      ? "text-red-500"
                                      : "opacity-60 hover:text-red-500"
                                  }`}
                                  title="Report a problem"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                      </div>

                      {isUser && (
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow ${
                            darkMode
                              ? "bg-white/10 text-slate-200"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          <User className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  );
                }
              )}

              {isLoading && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Bot className="h-5 w-5" />
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      darkMode
                        ? "bg-white/5"
                        : "bg-white shadow-sm"
                    }`}
                  >
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />

                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
                        style={{
                          animationDelay:
                            "150ms",
                        }}
                      />

                      <span
                        className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
                        style={{
                          animationDelay:
                            "300ms",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div
                ref={
                  messagesEndRef
                }
              />
            </div>
          )}

          {/* SCROLL BUTTON */}

          {showScrollBottom && (
            <button
              onClick={
                scrollToBottom
              }
              className={`absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-lg transition ${
                darkMode
                  ? "border-white/10 bg-[#111113] text-white hover:bg-white/10"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Scroll to bottom
            </button>
          )}

          {/* =================================================
              COMPOSER
              ================================================= */}

          <div className="sticky bottom-0 bg-transparent pb-5 pt-3">
            <div
              className={`relative rounded-2xl border p-2 shadow-xl ${
                darkMode
                  ? "border-white/10 bg-[#111113]"
                  : "border-slate-200 bg-white"
              }`}
            >
              {/* ATTACHMENT */}

              {attachedFile && (
                <div
                  className={`mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium ${
                    darkMode
                      ? "border border-white/10 bg-white/5"
                      : "border border-slate-200 bg-slate-100"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {attachedFile.type.startsWith(
                      "image/"
                    ) ? (
                      <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                    )}

                    <span className="truncate">
                      {attachedFile.name}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      setAttachedFile(
                        null
                      )
                    }
                    className="rounded p-1 transition hover:bg-red-500/10 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* TEXT INPUT */}

              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={
                  handleKeyDown
                }
                disabled={
                  isLoading ||
                  isGeneratingFile
                }
                placeholder={
                  isRecording
                    ? "Listening..."
                    : "Ask Gemini anything or attach a file..."
                }
                rows={1}
                className={`max-h-[180px] w-full resize-none bg-transparent p-3 outline-none ${
                  isRecording
                    ? "animate-pulse font-medium text-red-500"
                    : ""
                }`}
              />

              {/* HIDDEN FILE INPUT */}

              <input
                type="file"
                ref={
                  fileInputRef
                }
                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.js,.jsx,.ts,.tsx,.py,.ppt,.pptx,.xlsx"
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];

                  if (file) {
                    setAttachedFile(
                      file
                    );
                  }

                  event.target.value =
                    "";
                }}
                className="hidden"
              />

              {/* CONTROLS */}

              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1">
                  {/* ATTACH */}

                  <button
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={
                      isLoading ||
                      isGeneratingFile
                    }
                    className={`rounded-lg p-2.5 transition ${
                      darkMode
                        ? "opacity-70 hover:bg-white/10 hover:opacity-100"
                        : "opacity-70 hover:bg-slate-100 hover:opacity-100"
                    } disabled:cursor-not-allowed disabled:opacity-30`}
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  {/* MICROPHONE */}

                  <button
                    onClick={
                      isRecording
                        ? stopVoiceRecording
                        : startVoiceRecording
                    }
                    disabled={
                      !voiceSupported ||
                      isLoading ||
                      isGeneratingFile
                    }
                    className={`rounded-lg p-2.5 transition ${
                      isRecording
                        ? "animate-pulse bg-red-500 text-white"
                        : darkMode
                        ? "opacity-70 hover:bg-white/10 hover:opacity-100"
                        : "opacity-70 hover:bg-slate-100 hover:opacity-100"
                    } disabled:cursor-not-allowed disabled:opacity-30`}
                    title={
                      voiceSupported
                        ? "Voice input"
                        : "Speech recognition unavailable"
                    }
                  >
                    {isRecording ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>

                  {/* =================================================
                      FILE GENERATOR BUTTON
                      ================================================= */}

                  <div className="relative">
                    <button
                      onClick={() =>
                        setFileGeneratorOpen(
                          !fileGeneratorOpen
                        )
                      }
                      disabled={
                        !input.trim() ||
                        isLoading ||
                        isGeneratingFile ||
                        isRecording
                      }
                      className={`rounded-xl p-2.5 text-white shadow-md transition ${
                        isGeneratingFile
                          ? "cursor-wait bg-purple-400"
                          : "bg-purple-600 hover:bg-purple-700"
                      } disabled:cursor-not-allowed disabled:opacity-30`}
                      title="Create Word, PowerPoint or PDF"
                    >
                      <FileText className="h-4 w-4" />
                    </button>

                    {/* FILE GENERATOR MENU */}

                    {fileGeneratorOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() =>
                            setFileGeneratorOpen(
                              false
                            )
                          }
                        />

                        <div
                          className={`absolute bottom-14 left-0 z-50 w-80 rounded-2xl border p-2 shadow-2xl ${
                            darkMode
                              ? "border-white/10 bg-[#171719]"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-500" />

                              <div className="text-sm font-bold">
                                Create with AI
                              </div>
                            </div>

                            <div className="mt-1 text-xs opacity-50">
                              Gemini will create the content
                              and design.
                            </div>
                          </div>

                          {/* DESIGN */}

                          <div className="px-3 py-2">
                            <label className="mb-1 block text-[10px] font-bold tracking-wider opacity-50">
                              DESIGN STYLE
                            </label>

                            <select
                              value={
                                designStyle
                              }
                              onChange={(
                                event
                              ) =>
                                setDesignStyle(
                                  event
                                    .target
                                    .value
                                )
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                                darkMode
                                  ? "border-white/10 bg-black/20 text-white"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <option value="professional">
                                Professional
                              </option>

                              <option value="corporate">
                                Corporate
                              </option>

                              <option value="engineering">
                                Engineering
                              </option>

                              <option value="minimal">
                                Minimal
                              </option>

                              <option value="modern">
                                Modern
                              </option>

                              <option value="dark">
                                Dark
                              </option>

                              <option value="creative">
                                Creative
                              </option>

                              <option value="academic">
                                Academic
                              </option>

                              <option value="luxury">
                                Luxury
                              </option>
                            </select>
                          </div>

                          <div className="my-1 border-t border-inherit" />

                          {/* WORD */}

                          <button
                            onClick={() =>
                              generateAIFile(
                                "docx"
                              )
                            }
                            disabled={
                              isGeneratingFile
                            }
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                              darkMode
                                ? "hover:bg-blue-500/10"
                                : "hover:bg-blue-50"
                            }`}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-lg">
                              📄
                            </div>

                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                Word Document
                              </div>

                              <div className="text-xs opacity-50">
                                Professional .docx
                              </div>
                            </div>
                          </button>

                          {/* POWERPOINT */}

                          <button
                            onClick={() =>
                              generateAIFile(
                                "pptx"
                              )
                            }
                            disabled={
                              isGeneratingFile
                            }
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                              darkMode
                                ? "hover:bg-orange-500/10"
                                : "hover:bg-orange-50"
                            }`}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-lg">
                              📊
                            </div>

                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                PowerPoint
                              </div>

                              <div className="text-xs opacity-50">
                                Canva-style .pptx
                              </div>
                            </div>
                          </button>

                          {/* PDF */}

                          <button
                            onClick={() =>
                              generateAIFile(
                                "pdf"
                              )
                            }
                            disabled={
                              isGeneratingFile
                            }
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                              darkMode
                                ? "hover:bg-red-500/10"
                                : "hover:bg-red-50"
                            }`}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-lg">
                              📕
                            </div>

                            <div className="min-w-0">
                              <div className="text-sm font-semibold">
                                PDF
                              </div>

                              <div className="text-xs opacity-50">
                                Designed .pdf
                              </div>
                            </div>
                          </button>

                          {isGeneratingFile && (
                            <div className="px-3 py-2">
                              <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-500">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                                Gemini is designing your
                                file...
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* SEND */}

                <button
                  onClick={
                    sendMessage
                  }
                  disabled={
                    (!input.trim() &&
                      !attachedFile) ||
                    isLoading ||
                    isRecording ||
                    isGeneratingFile
                  }
                  className="rounded-xl bg-blue-600 p-2.5 text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="mt-2 text-center text-xs opacity-40">
              Enter to send • Shift + Enter for a
              new line • Purple button creates files
            </p>
          </div>
        </main>
      </div>

      {/* =====================================================
          SETTINGS MODAL
          ===================================================== */}

      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              darkMode
                ? "border-white/10 bg-[#141416] text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div className="mb-4 flex items-center justify-between border-b border-inherit pb-3">
              <h3 className="text-lg font-bold">
                AI Settings
              </h3>

              <button
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
                className="rounded-lg p-1.5 transition hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* SYSTEM */}

              <div>
                <label className="mb-1 block text-sm font-medium opacity-80">
                  System Instructions
                </label>

                <textarea
                  value={
                    systemInstruction
                  }
                  onChange={(event) =>
                    setSystemInstruction(
                      event.target.value
                    )
                  }
                  rows={4}
                  className={`w-full resize-none rounded-xl border p-3 text-sm outline-none ${
                    darkMode
                      ? "border-white/10 bg-black/40"
                      : "border-slate-200 bg-slate-50"
                  }`}
                  placeholder="Define how Gemini should behave..."
                />
              </div>

              {/* TEMPERATURE */}

              <div>
                <div className="mb-1 flex justify-between text-sm font-medium opacity-80">
                  <span>
                    Temperature
                  </span>

                  <span>
                    {temperature.toFixed(
                      1
                    )}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={
                    temperature
                  }
                  onChange={(event) =>
                    setTemperature(
                      parseFloat(
                        event.target
                          .value
                      )
                    )
                  }
                  className="w-full cursor-pointer accent-blue-600"
                />

                <div className="mt-1 flex justify-between text-xs opacity-40">
                  <span>
                    Precise
                  </span>

                  <span>
                    Creative
                  </span>
                </div>
              </div>

              {/* VOICE */}

              <div
                className={`rounded-xl p-3 text-xs ${
                  darkMode
                    ? "bg-white/5"
                    : "bg-slate-100"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <Mic className="h-4 w-4 text-blue-500" />

                  Voice Input
                </div>

                {voiceSupported ? (
                  <span className="text-green-500">
                    ✓ Speech recognition
                    supported
                  </span>
                ) : (
                  <span className="text-red-500">
                    ✕ Use Chrome or Edge for
                    microphone input
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  setSettingsOpen(
                    false
                  )
                }
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          COMPLAINT SIDEBAR
          ===================================================== */}

      {complaintOpen && (
        <>
          <div
            onClick={() =>
              setComplaintOpen(
                false
              )
            }
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm"
          />

          <aside
            className={`fixed right-0 top-0 z-[120] flex h-full w-full max-w-md flex-col border-l shadow-2xl ${
              darkMode
                ? "border-white/10 bg-[#111113] text-white"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-inherit px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>

                <div>
                  <h2 className="text-lg font-bold">
                    Report a problem
                  </h2>

                  <p className="text-xs opacity-50">
                    Help us improve this
                    response
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  setComplaintOpen(
                    false
                  )
                }
                className="rounded-lg p-2 transition hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* CONTENT */}

            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="mb-3 text-sm font-semibold">
                What went wrong?
              </h3>

              <div className="space-y-2">
                {[
                  "Incorrect answer",
                  "Not helpful",
                  "Didn't understand my request",
                  "File wasn't analyzed correctly",
                  "Response was too slow",
                  "Other",
                ].map(
                  (reason) => (
                    <button
                      key={reason}
                      onClick={() =>
                        setComplaintReason(
                          reason
                        )
                      }
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                        complaintReason ===
                        reason
                          ? "border-blue-500 bg-blue-500/10 text-blue-500"
                          : darkMode
                          ? "border-white/10 hover:bg-white/5"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>
                          {reason}
                        </span>

                        {complaintReason ===
                          reason && (
                          <Check className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    </button>
                  )
                )}
              </div>

              {/* DETAILS */}

              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold">
                  Tell us more

                  <span className="ml-1 text-xs font-normal opacity-40">
                    (optional)
                  </span>
                </label>

                <textarea
                  value={
                    complaintDetails
                  }
                  onChange={(event) =>
                    setComplaintDetails(
                      event.target.value
                    )
                  }
                  rows={6}
                  placeholder="What should Gemini have done differently?"
                  className={`w-full resize-none rounded-xl border p-3 text-sm outline-none ${
                    darkMode
                      ? "border-white/10 bg-black/20 placeholder:text-slate-600"
                      : "border-slate-200 bg-slate-50 placeholder:text-slate-400"
                  }`}
                />
              </div>

              {/* RESPONSE PREVIEW */}

              {complaintMessageIndex !==
                null && (
                <div className="mt-6">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-40">
                    Gemini Response
                  </div>

                  <div
                    className={`max-h-40 overflow-y-auto rounded-xl p-3 text-xs leading-5 ${
                      darkMode
                        ? "bg-white/5 text-slate-400"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {
                      messages[
                        complaintMessageIndex
                      ]?.content
                    }
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}

            <div className="border-t border-inherit p-5">
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setComplaintOpen(
                      false
                    )
                  }
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium ${
                    darkMode
                      ? "border-white/10 hover:bg-white/5"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Cancel
                </button>

                <button
                  onClick={
                    submitComplaint
                  }
                  disabled={
                    !complaintReason &&
                    !complaintDetails.trim()
                  }
                  className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit Report
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] opacity-40">
                Your feedback helps improve
                the AI assistant.
              </p>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}