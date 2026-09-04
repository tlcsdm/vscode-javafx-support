# JavaFX Support — User Guide

Welcome to **Tlcsdm JavaFX Support**. This guide explains how to use every feature of
the extension so you can be productive with JavaFX and FXML inside VS Code.

> Tip: Open this guide at any time from the Command Palette (`Ctrl+Shift+P` /
> `Cmd+Shift+P`) by running **JavaFX: Show Help**.

## Table of Contents

- [Getting Started](#getting-started)
- [FXML Syntax Highlighting](#fxml-syntax-highlighting)
- [Open in Scene Builder](#open-in-scene-builder)
- [FXML Formatting](#fxml-formatting)
- [Linked Editing](#linked-editing)
- [Code Navigation](#code-navigation)
- [Find All References](#find-all-references)
- [Workspace Symbol Search](#workspace-symbol-search)
- [FXML Hover](#fxml-hover)
- [FXML Diagnostics](#fxml-diagnostics)
- [FXML Quick Fixes](#fxml-quick-fixes)
- [JavaFX CSS IntelliSense](#javafx-css-intellisense)
- [Outline View](#outline-view)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Getting Started

1. Install **Tlcsdm JavaFX Support** from the VS Code Marketplace.
2. Open a folder or workspace that contains JavaFX `.fxml` and `.java` files.
3. Open any `.fxml` file — it will automatically switch to the FXML language mode.

## FXML Syntax Highlighting

Open any `.fxml` file and it will automatically use the FXML language mode with full
syntax highlighting for tags, attributes, `fx:*` namespaces, event handlers, and
string values.

## Open in Scene Builder

1. Open an `.fxml` file in VS Code, or select one in the file explorer.
2. Right-click in the editor or in the explorer.
3. Select **Open in Scene Builder**.

If Scene Builder cannot be found automatically, set its path with the
**JavaFX: Set Scene Builder Path** command, or via the
`tlcsdm.javafxSupport.sceneBuilderPath` setting.

## FXML Formatting

1. Open an `.fxml` file.
2. Press `Shift+Alt+F` (or your configured *Format Document* shortcut) to format the
   whole document, or select a range and run *Format Selection*.

## Linked Editing

- Rename an opening tag such as `<Label>` and VS Code keeps the matching closing tag
  `</Label>` in sync while you type.
- Linked editing is enabled by default for FXML files.

## Code Navigation

**FXML → Controller / Resources**

- `Ctrl`/`Cmd`+Click on `fx:controller="com.example.MyController"` to open the controller class.
- `Ctrl`/`Cmd`+Click on `fx:id="myButton"` to jump to the `@FXML` annotated field.
- `Ctrl`/`Cmd`+Click on `onAction="#handleClick"` to jump to the `@FXML` annotated method.
- `Ctrl`/`Cmd`+Click on `@image.png` or `@style.css` resource references to open the
  referenced file relative to the current FXML file.
- `Ctrl`/`Cmd`+Click on `styleClass="primary-button"` to jump to matching
  `.primary-button` selectors in workspace CSS files.

**Controller → FXML**

- `Ctrl`/`Cmd`+Click on an `@FXML` annotated field to jump to the `fx:id` in the FXML file.
- `Ctrl`/`Cmd`+Click on an `@FXML` annotated method to jump to the event handler in the FXML file.

**CSS → FXML**

- Press `Shift+F12` on a CSS selector such as `.primary-button` to list matching
  `styleClass` usages in workspace FXML files.

## Find All References

- Press `Shift+F12` on an FXML `fx:id="myButton"` to find `$myButton` usages in the
  current FXML file together with the matching controller field declaration.

## Workspace Symbol Search

- Press `Ctrl+T` (Windows/Linux) or `Cmd+T` (macOS).
- Search for an FXML `fx:id` value or a matching Java `@FXML` field name to jump to it
  from anywhere in the workspace.

## FXML Hover

- Hovering `fx:controller`, `fx:id`, or an event handler shows the matching controller
  class, field, or method comment (including inherited members).
- Hover is **disabled by default**. Enable it with `tlcsdm.javafxSupport.hover.enabled`
  and adjust the delay with `tlcsdm.javafxSupport.hover.delay`.

## FXML Diagnostics

Problems are reported in the **Problems** panel:

- Missing `fx:controller` classes are reported as errors.
- `fx:id` values without matching controller fields are reported as warnings.
- Missing controller event handlers such as `#handleClick` are reported as errors.
- Duplicate `fx:id` values in the same FXML file are reported as errors.

## FXML Quick Fixes

- Use `Ctrl+.` / `Cmd+.` on a missing `fx:id` warning to generate
  `@FXML private <Type> <fxId>;` in the controller.
- Use `Ctrl+.` / `Cmd+.` on a missing `onAction` handler error to generate
  `@FXML private void <handler>(ActionEvent event) {}` in the controller.

## JavaFX CSS IntelliSense

- Type `-fx-` in a `.css` file or an FXML `style` attribute to see JavaFX-specific CSS
  properties such as `-fx-background-color`, `-fx-font-size`, and `-fx-text-fill`.
- Type inside an FXML `styleClass=""` attribute to complete CSS class names discovered
  from workspace `.css` files.
- After properties such as `-fx-alignment:`, completion suggests common enum-like values
  such as `CENTER` and `TOP_LEFT`.
- Hover a JavaFX CSS property to see its syntax, default value, and where it applies.

## Outline View

Open the **Outline** view to see the FXML element tree. Use the settings
`tlcsdm.javafxSupport.outline.showFxId` and `tlcsdm.javafxSupport.outline.showText`
to control whether `fx:id` and `text` details are shown for each node.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `tlcsdm.javafxSupport.sceneBuilderPath` | Path to Scene Builder executable | `""` (auto-detect) |
| `tlcsdm.javafxSupport.hover.enabled` | Enable FXML hover information | `false` |
| `tlcsdm.javafxSupport.hover.delay` | Delay in milliseconds before showing FXML hover information | `300` |
| `tlcsdm.javafxSupport.outline.showFxId` | Show `fx:id` details in the FXML Outline view | `true` |
| `tlcsdm.javafxSupport.outline.showText` | Show `text` details in the FXML Outline view | `true` |

## Troubleshooting

- **`.fxml` files open as XML** — the extension automatically corrects the language to
  FXML. If it does not, run *Change Language Mode* and select **FXML**.
- **Scene Builder does not open** — set `tlcsdm.javafxSupport.sceneBuilderPath` to the
  full path of the Scene Builder executable, or run **JavaFX: Set Scene Builder Path**.
- **Navigation does not resolve** — make sure the controller `.java` files are inside
  the open workspace so they can be indexed.

For issues and feature requests, visit the
[project repository](https://github.com/tlcsdm/vscode-javafx-support/issues).
