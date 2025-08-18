# Reflex Coder

Reflex Coder is a web-based dashboard for an intelligent, reinforcement-learning-powered coding copilot. It provides a user interface to interact with an autonomous agent, monitor its activities, manage AI model API keys, and observe its training progress.

## Features

-   **Agent Activity Monitoring**: View a real-time log of the agent's thoughts, actions, and tool usage.
-   **Command Execution**: Input natural language commands to the coding agent.
-   **API Key Management**: Securely manage API keys for various AI providers like OpenRouter, Anthropic, OpenAI, and more.
-   **Training Dashboard**: Visualize the agent's reinforcement learning progress, including success rate and average steps.
-   **Model Selection**: Choose from a variety of available AI models for the agent to use.

## Getting Started

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

## Technologies Used

This project is built with:

-   [Vite](https://vitejs.dev/) - Frontend Tooling
-   [React](https://reactjs.org/) - UI Library
-   [TypeScript](https://www.typescriptlang.org/) - Language
-   [Tailwind CSS](https://tailwindcss.com/) - CSS Framework
-   [shadcn/ui](https://ui.shadcn.com/) - UI Components
-   [React Router](https://reactrouter.com/) - Routing
-   [Lucide React](https://lucide.dev/) - Icons
