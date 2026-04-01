# Change Log

## [1.0.3] - 2026-04-01

### Added
- Enhanced FXML syntax highlighting with distinct colors for class tags and property tags
- Class elements (uppercase, e.g. VBox, GridPane) now use `support.class` scope (teal in dark themes)
- Property elements (lowercase, e.g. children, columnConstraints) use `entity.name.tag` scope (blue in dark themes)
- `fx:*` attributes now use `keyword.control` scope (purple in dark themes) for better visibility
- Import statements highlight the `import` keyword, package path, and wildcard separately
- Comfortable color support for both light and dark themes using standard TextMate scopes

### Fixed
- Import processing instruction pattern was shadowed by the generic XML processing instruction pattern

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
