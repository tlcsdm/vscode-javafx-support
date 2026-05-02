# JavaFX Support

A VS Code extension for JavaFX development with FXML support.

## Features

- 🎨 **FXML Syntax Highlighting** - Full syntax highlighting for `.fxml` files
- 🏗️ **FXML Language Mode** - To open `.fxml` file in Scene Builder, select 'Open in Scene Builder' from the context menu
- 🔧 **Scene Builder Integration** - Configure Scene Builder path and open FXML files directly in Scene Builder
- 📐 **Formatter** - You can use an XML formatter specifically designed for FXML
- ✏️ **Linked Editing** - Renaming an opening FXML tag also updates the matching closing tag
- 🚨 **FXML Diagnostics** - Surface missing controller classes and duplicate `fx:id` values directly in the Problems panel
- 🔗 **FXML → Controller & Resource Navigation** - Ctrl+Click on `fx:controller`, `onAction`, `fx:id`, `@image.png`, or `@style.css` in FXML to jump to the corresponding controller code or referenced resource file
- 🔗 **Controller → FXML Navigation** - Ctrl+Click on `@FXML` annotated variables or methods in the Controller class to jump to the corresponding location in the FXML file
- 🔎 **Find All References** - Press `Shift+F12` on an FXML `fx:id` to find `$fxId` usages in the current FXML file together with the matching controller field declaration
- 🔍 **Workspace Symbols** - Press `Ctrl+T` / `Cmd+T` to search `fx:id` values and matching `@FXML` field names across the workspace
- 💡 **FXML Hover** - Optionally show controller field and event handler comments on hover
- 🎨 **JavaFX CSS IntelliSense** - Get `-fx-` property completions, enum-like value suggestions, and hover details inside `.css` files
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

### Linked Editing

- Rename an opening tag such as `<Label>` and VS Code will keep the matching closing tag `</Label>` in sync while you type
- Linked editing is enabled by default for FXML files

### Code Navigation

**FXML → Controller:**
- Ctrl+Click on `fx:controller="com.example.MyController"` to open the controller class
- Ctrl+Click on `fx:id="myButton"` to jump to the `@FXML` annotated field
- Ctrl+Click on `onAction="#handleClick"` to jump to the `@FXML` annotated method
- Ctrl+Click on `image="@images/logo.png"` or `stylesheets="@styles/main.css"` to open the referenced resource file relative to the current FXML file
- Press `Shift+F12` on `fx:id="myButton"` to list `$myButton` usages in the current FXML document and the matching controller field declaration

**Controller → FXML:**
- Ctrl+Click on an `@FXML` annotated field to jump to the `fx:id` in the FXML file
- Ctrl+Click on an `@FXML` annotated method to jump to the event handler in the FXML file

### Workspace Symbol Search

- Press `Ctrl+T` (Windows/Linux) or `Cmd+T` (macOS)
- Search for an FXML `fx:id` or a matching Java `@FXML` field name to jump to it from anywhere in the workspace

### FXML Hover

- Hovering `fx:controller="com.example.MyController"` shows the matching controller class comment
- Hovering `fx:id="myButton"` shows the matching controller field comment, including inherited members
- Hovering `onAction="#handleClick"` shows the matching controller method comment, including inherited members
- Hover is disabled by default and can be enabled with a configurable delay

### FXML Diagnostics

- Missing `fx:controller` classes are reported as errors
- `fx:id` values without matching controller fields are reported as warnings
- Missing controller event handlers such as `#handleClick` are reported as errors
- Duplicate `fx:id` values in the same FXML file are reported as errors

### JavaFX CSS IntelliSense

- Type `-fx-` in a `.css` file to see JavaFX-specific CSS properties such as `-fx-background-color`, `-fx-font-size`, and `-fx-text-fill`
- After properties such as `-fx-alignment:`, completion suggests common enum-like values such as `CENTER` and `TOP_LEFT`
- Hover a JavaFX CSS property to see its syntax, default value, and where it applies

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `tlcsdm.javafxSupport.sceneBuilderPath` | Path to Scene Builder executable | `""` (auto-detect) |
| `tlcsdm.javafxSupport.hover.enabled` | Enable FXML hover information for controller comments referenced by `fx:controller`, `fx:id`, and event handlers | `false` |
| `tlcsdm.javafxSupport.outline.showFxId` | Show `fx:id` details in the FXML Outline view | `true` |
| `tlcsdm.javafxSupport.outline.showText` | Show `text` details in the FXML Outline view | `true` |
| `tlcsdm.javafxSupport.hover.delay` | Delay in milliseconds before showing FXML hover information | `300` |

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
