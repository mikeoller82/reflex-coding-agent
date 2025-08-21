<div align="center">
  <img src="https://firebasestorage.googleapis.com/v0/b/firebase-veilnet.firebasestorage.app/o/reflex-coder-logo.svg?alt=media&token=5238a68c-54ab-424b-9c31-70ef934fd49d" alt="Reflex Coder Logo" width="150"/>
  <br/>
  <br/>

  # Reflex Coder

  **An intelligent, RL-powered coding copilot with autonomous reasoning and a sleek dashboard.**

  [![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/--blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/--blue?logo=react&logoColor=white)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/--blue?logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

Reflex Coder is a sophisticated, web-based dashboard for an autonomous AI coding agent. This developer tool is built for observing and interacting with a reinforcement-learning-powered copilot. It provides a rich user interface to issue commands, monitor the agent's cognitive processes (thoughts, actions, tool usage), securely manage API keys for various AI providers (like OpenRouter, Anthropic, and OpenAI), and visualize the agent's long-term training progress.

This project serves as a powerful demonstration of how autonomous agents can be managed and monitored, providing a glimpse into the future of AI-assisted software development.

## 🚀 Why Reflex Coder?

In an era where AI is becoming a core part of the development workflow, transparent and controllable agentic systems are crucial. Reflex Coder aims to solve this by providing:
-   **Full Transparency**: No more black boxes. See exactly what the AI is thinking and doing at every step.
-   **Interactive Control**: Guide the agent with natural language, and pause or stop its execution.
-   **Provider Flexibility**: Avoid vendor lock-in by connecting to a wide range of AI model providers.
-   **Insightful Analytics**: Understand the agent's performance and learning curve through a dedicated training dashboard.

## ✨ Features

-   **Agent Activity Monitoring**: View a real-time log of the agent's thoughts, actions, and tool usage.
-   **Command Execution**: Input natural language commands to the coding agent.
-   **Secure API Key Management**: Manage API keys for various AI providers, stored securely.
-   **Training Dashboard**: Visualize the agent's reinforcement learning progress.
-   **Model Selection**: Choose from a variety of available AI models for the agent to use.

## 📸 Live Demo / Screenshot
![Reflex Coder Screenshot](https://firebasestorage.googleapis.com/v0/b/firebase-veilnet.firebasestorage.app/o/screenshot_region_2025-08-18_17-28-58.png?alt=media&token=b5bff7f0-ea30-4e16-be7b-32388dde7d68)

## 🛠️ Technologies Used

This project is built with a modern, robust tech stack:

-   **Frontend**: [Vite](https://vitejs.dev/), [React](https://reactjs.org/), [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
-   **Routing**: [React Router](https://reactrouter.com/)
-   **Icons**: [Lucide React](https://lucide.dev/)

## ⚙️ Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed on your machine.

### Installation & Running

1.  **Clone the repo**
    ```sh
    git clone <YOUR_GIT_URL>
    ```
2.  **Navigate to the project directory**
    ```sh
    cd <YOUR_PROJECT_NAME>
    ```
3.  **Install NPM packages**
    ```sh
    npm install
    ```
4.  **Run the development server**
    ```sh
    npm run dev
    ```
    The application will be available at `http://localhost:5173` (or another port if 5173 is busy).

## 🧩 Natural Language → Code

Reflex Coder now generates and persists code directly from natural language instructions, similar to Claude or Codex. The agent:
- Analyzes your request and plans implementation steps.
- Emits JSON tool calls like `write_file`, `run_shell`, and `git_commit`.
- Writes files to the local workspace via built-in dev server APIs.
- Shows all generated files in the “Generated Code” panel for quick copy/download.

Server endpoints exposed by the dev server (used by the agent):
- `POST /api/files/write` with `{ path, content, overwrite, cwd? }` to write files. If `cwd` is provided, `path` is resolved relative to that directory.
- `POST /api/files/read` with `{ path, cwd? }` to read file contents.
- `POST /api/files/list` with `{ cwd?, path?: '.', maxDepth?: number }` to list files/dirs relative to `cwd`.
- `POST /api/files/delete` with `{ path, cwd?, recursive? }` to delete files/dirs.
- `POST /api/files/move` with `{ from, to, cwd?, overwrite? }` to move/rename.
- `POST /api/files/mkdir` with `{ path, cwd?, recursive? }` to create directories.
- `POST /api/shell` with `{ cmd, cwd? }` to execute shell commands in the optional working directory and return output.
- `POST /api/git/commit` with `{ msg, cwd? }` to commit changes in the optional working directory.

To use, enter a clear instruction in the dashboard (e.g., “add a React hook for debounced search with tests”), select a model, and Run. Set the Workspace Directory to a relative or absolute path; the agent executes all operations with `cwd` set to that directory.

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
