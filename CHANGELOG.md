# Change Log

## [unreleased]

### Added
- Add Go to Definition support for FXML `@resource` references such as `@image.png` and `@style.css`
- Add FXML diagnostics for missing `fx:controller` classes, duplicate `fx:id` values, unresolved controller fields, and missing event handlers

## [1.0.4] - 2026-05-02

### Added
- Linked editing for matching FXML start/end tags so renaming `<Label>` also updates `</Label>`
- FXML folding ranges for nested elements, default-collapsed consecutive `<?import ...?>` blocks, and multiline tags
- Add Go to Definition support for FXML includes

### Fixed
- Enabled linked editing by default for FXML files so matching tag renames take effect immediately
- Added `CancellationToken` checks to navigation, CodeLens, outline, and formatting providers to avoid returning stale results from canceled requests
- FXML/controller navigation now resolves `@FXML` members inherited from controller superclasses

## [1.0.3] - 2026-04-02

### Fixed
- Rewrote FXML syntax highlighting grammar to prevent XML grammar override
- Changed scopeName from `text.xml.fxml` to `source.fxml` to block XML extension injection
- Fixed dark theme appearance: brackets use `punctuation.definition.tag` (gray) instead of `comment` (green)
- Added proper color distinction for FXML elements in both light and dark themes:
  - Class tags (`BorderPane`, `VBox`) — teal
  - Property tags (`top`, `padding`) — blue
  - `fx:*` tags and attributes — purple
  - Event handlers (`onAction`) — yellow
  - Regular attributes — light blue
  - String values — orange
  - XML comments — green
- Added `files.associations` and `editor.semanticHighlighting.enabled: false` for FXML to prevent XML semantic token overrides
- Added programmatic language enforcement to correct `.fxml` files misdetected as XML

### Changed
- Updated language configuration with improved auto-closing pairs, surrounding pairs, and indentation rules

## [1.0.1] - 2026-03-11

### Added
- Support for displaying FXML files in the Outline view

## [1.0.0] - 2026-02-26

### Added
- Initial release
- FXML syntax highlighting with TextMate grammar
- FXML language mode registration
- Scene Builder integration with configurable path
- "Open in Scene Builder" context menu for FXML files
- FXML document formatter
- FXML → Controller navigation (fx:controller, fx:id, onAction)
- Controller → FXML navigation (@FXML annotated fields and methods)
- Internationalization support (English, Chinese, Japanese)
