# JavaFX Support

A VS Code extension for JavaFX development with FXML support.

## Features

- 🎨 **FXML Syntax Highlighting** - Full syntax highlighting for `.fxml` files
- 🏗️ **FXML Language Mode** - To open `.fxml` file in Scene Builder, select 'Open in Scene Builder' from the context menu
- 🔧 **Scene Builder Integration** - Configure Scene Builder path and open FXML files directly in Scene Builder
- 📐 **Formatter** - You can use an XML formatter specifically designed for FXML
- 🔗 **FXML → Controller Navigation** - Ctrl+Click on `fx:controller`, `onAction`, or `fx:id` in FXML to jump to the corresponding code in the Controller class
- 🔗 **Controller → FXML Navigation** - Ctrl+Click on `@FXML` annotated variables or methods in the Controller class to jump to the corresponding location in the FXML file
- 🌐 **Internationalization** - English, Chinese, Japanese language support

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Tlcsdm JavaFX Support"
4. Click Install

### From VSIX File

1. Download the latest `.vsix` file from [Releases](https://github.com/tlcsdm/vscode-javafx-support/releases)
2. Open VS Code
3. Go to Extensions (Ctrl+Shift+X)
4. Click the `...` menu and select "Install from VSIX..."
5. Select the downloaded `.vsix` file

### From Jenkins  
Download from [Jenkins](https://jenkins.tlcsdm.com/job/vscode-plugin/job/vscode-javafx-support/)

## Usage

### FXML Syntax Highlighting

Open any `.fxml` file and it will automatically use the FXML language mode with syntax highlighting.

### Open in Scene Builder

1. Open an `.fxml` file in VS Code
2. Right-click in the editor or file explorer
3. Select **"Open in Scene Builder"**

### FXML Formatting

1. Open an `.fxml` file
2. Use `Shift+Alt+F` (or your configured format shortcut) to format the document

### Code Navigation

**FXML → Controller:**
- Ctrl+Click on `fx:controller="com.example.MyController"` to open the controller class
- Ctrl+Click on `fx:id="myButton"` to jump to the `@FXML` annotated field
- Ctrl+Click on `onAction="#handleClick"` to jump to the `@FXML` annotated method

**Controller → FXML:**
- Ctrl+Click on an `@FXML` annotated field to jump to the `fx:id` in the FXML file
- Ctrl+Click on an `@FXML` annotated method to jump to the event handler in the FXML file

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `tlcsdm.javafxSupport.sceneBuilderPath` | Path to Scene Builder executable | `""` (auto-detect) |

## Development

### Prerequisites

- Node.js 22.x or later
- npm

### Build

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode (for development)
npm run watch

# Lint
npm run lint

# Package
npx @vscode/vsce package

# Test
npm run test

# Package extension
npx @vscode/vsce package
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
