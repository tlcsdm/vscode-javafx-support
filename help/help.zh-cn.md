# JavaFX Support — 使用说明

欢迎使用 **Tlcsdm JavaFX 支持**。本指南介绍扩展的每一项功能，帮助你在 VS Code 中
高效地进行 JavaFX 与 FXML 开发。

> 提示：随时可通过命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）运行
> **JavaFX: 显示帮助** 打开本指南。

## 目录

- [快速开始](#快速开始)
- [FXML 语法高亮](#fxml-语法高亮)
- [在 Scene Builder 中打开](#在-scene-builder-中打开)
- [FXML 格式化](#fxml-格式化)
- [关联编辑](#关联编辑)
- [代码导航](#代码导航)
- [查找所有引用](#查找所有引用)
- [工作区符号搜索](#工作区符号搜索)
- [FXML 悬停](#fxml-悬停)
- [FXML 诊断](#fxml-诊断)
- [FXML 快速修复](#fxml-快速修复)
- [JavaFX CSS 智能提示](#javafx-css-智能提示)
- [大纲视图](#大纲视图)
- [配置项](#配置项)
- [故障排查](#故障排查)

## 快速开始

1. 从 VS Code 扩展市场安装 **Tlcsdm JavaFX 支持**。
2. 打开包含 JavaFX `.fxml` 与 `.java` 文件的文件夹或工作区。
3. 打开任意 `.fxml` 文件——它会自动切换到 FXML 语言模式。

## FXML 语法高亮

打开任意 `.fxml` 文件即可自动使用 FXML 语言模式，为标签、属性、`fx:*` 命名空间、
事件处理器和字符串值提供完整的语法高亮。

## 在 Scene Builder 中打开

1. 在 VS Code 中打开一个 `.fxml` 文件，或在文件资源管理器中选中它。
2. 在编辑器或资源管理器中右键单击。
3. 选择 **在 Scene Builder 中打开**。

如果无法自动找到 Scene Builder，请使用 **JavaFX: 设置 Scene Builder 路径** 命令，
或通过 `tlcsdm.javafxSupport.sceneBuilderPath` 设置其路径。

## FXML 格式化

1. 打开一个 `.fxml` 文件。
2. 按 `Shift+Alt+F`（或你配置的“格式化文档”快捷键）格式化整个文档，
   或选中一段范围后运行“格式化选定内容”。

## 关联编辑

- 重命名如 `<Label>` 这样的开始标签时，VS Code 会在你输入时同步更新匹配的
  结束标签 `</Label>`。
- 关联编辑对 FXML 文件默认启用。

## 代码导航

**FXML → 控制器 / 资源**

- 在 `fx:controller="com.example.MyController"` 上按 `Ctrl`/`Cmd`+单击打开控制器类。
- 在 `fx:id="myButton"` 上按 `Ctrl`/`Cmd`+单击跳转到 `@FXML` 注解的字段。
- 在 `onAction="#handleClick"` 上按 `Ctrl`/`Cmd`+单击跳转到 `@FXML` 注解的方法。
- 在 `@image.png` 或 `@style.css` 等资源引用上按 `Ctrl`/`Cmd`+单击，
  打开相对于当前 FXML 文件的被引用文件。
- 在 `styleClass="primary-button"` 上按 `Ctrl`/`Cmd`+单击，跳转到工作区 CSS 文件中
  匹配的 `.primary-button` 选择器。

**控制器 → FXML**

- 在 `@FXML` 注解的字段上按 `Ctrl`/`Cmd`+单击跳转到 FXML 文件中的 `fx:id`。
- 在 `@FXML` 注解的方法上按 `Ctrl`/`Cmd`+单击跳转到 FXML 文件中的事件处理器。

**CSS → FXML**

- 在 `.primary-button` 这样的 CSS 选择器上按 `Shift+F12`，列出工作区 FXML 文件中
  匹配的 `styleClass` 用法。

## 查找所有引用

- 在 FXML 的 `fx:id="myButton"` 上按 `Shift+F12`，查找当前 FXML 文件中的 `$myButton`
  用法以及匹配的控制器字段声明。

## 工作区符号搜索

- 按 `Ctrl+T`（Windows/Linux）或 `Cmd+T`（macOS）。
- 搜索 FXML 的 `fx:id` 值或匹配的 Java `@FXML` 字段名，即可从工作区任意位置跳转。

## FXML 悬停

- 悬停在 `fx:controller`、`fx:id` 或事件处理器上时，会显示匹配的控制器类、字段或
  方法的注释（包含继承的成员）。
- 悬停功能**默认关闭**。可通过 `tlcsdm.javafxSupport.hover.enabled` 启用，
  并通过 `tlcsdm.javafxSupport.hover.delay` 调整延迟。

## FXML 诊断

问题会显示在 **问题** 面板中：

- 缺失的 `fx:controller` 类会报告为错误。
- 没有匹配控制器字段的 `fx:id` 值会报告为警告。
- 缺失的控制器事件处理器（如 `#handleClick`）会报告为错误。
- 同一 FXML 文件中重复的 `fx:id` 值会报告为错误。

## FXML 快速修复

- 在缺失 `fx:id` 的警告上使用 `Ctrl+.` / `Cmd+.`，在控制器中生成
  `@FXML private <Type> <fxId>;`。
- 在缺失 `onAction` 处理器的错误上使用 `Ctrl+.` / `Cmd+.`，在控制器中生成
  `@FXML private void <handler>(ActionEvent event) {}`。

## JavaFX CSS 智能提示

- 在 `.css` 文件或 FXML 的 `style` 属性中输入 `-fx-`，即可看到 JavaFX 专属的 CSS
  属性，如 `-fx-background-color`、`-fx-font-size` 和 `-fx-text-fill`。
- 在 FXML 的 `styleClass=""` 属性中输入时，会补全从工作区 `.css` 文件发现的 CSS 类名。
- 在诸如 `-fx-alignment:` 之类的属性之后，补全会建议常见的枚举值，如 `CENTER`
  和 `TOP_LEFT`。
- 悬停 JavaFX CSS 属性可查看其语法、默认值以及适用范围。

## 大纲视图

打开 **大纲** 视图可查看 FXML 元素树。使用
`tlcsdm.javafxSupport.outline.showFxId` 和 `tlcsdm.javafxSupport.outline.showText`
设置控制每个节点是否显示 `fx:id` 与 `text` 详情。

## 配置项

| 设置 | 说明 | 默认值 |
|------|------|--------|
| `tlcsdm.javafxSupport.sceneBuilderPath` | Scene Builder 可执行文件的路径 | `""`（自动查找） |
| `tlcsdm.javafxSupport.hover.enabled` | 启用 FXML 悬停信息 | `false` |
| `tlcsdm.javafxSupport.hover.delay` | 显示 FXML 悬停信息前的延迟（毫秒） | `300` |
| `tlcsdm.javafxSupport.outline.showFxId` | 在 FXML 大纲视图中显示 `fx:id` 详情 | `true` |
| `tlcsdm.javafxSupport.outline.showText` | 在 FXML 大纲视图中显示 `text` 详情 | `true` |

## 故障排查

- **`.fxml` 文件被识别为 XML** —— 扩展会自动将语言更正为 FXML。如未生效，
  可运行“更改语言模式”并选择 **FXML**。
- **Scene Builder 无法打开** —— 将 `tlcsdm.javafxSupport.sceneBuilderPath` 设置为
  Scene Builder 可执行文件的完整路径，或运行 **JavaFX: 设置 Scene Builder 路径**。
- **导航无法解析** —— 确保控制器 `.java` 文件位于已打开的工作区中，以便被索引。

如需反馈问题或提出功能请求，请访问
[项目仓库](https://github.com/tlcsdm/vscode-javafx-support/issues)。
