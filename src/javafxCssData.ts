export interface JavafxCssPropertyDefinition {
    readonly name: string;
    readonly syntax: string;
    readonly defaultValue: string;
    readonly description: string;
    readonly appliesTo: readonly string[];
}

export const JAVA_FX_CSS_PROPERTY_DEFINITIONS: readonly JavafxCssPropertyDefinition[] = [
    {
        "name": "-fx-alignment",
        "syntax": "[ top-left | top-center | top-right | center-left | center | center-right | bottom-left | bottom-center | bottom-right | baseline-left | baseline-center | baseline-right ]",
        "defaultValue": "top-left",
        "description": "",
        "appliesTo": [
            "FlowPane",
            "GridPane",
            "HBox",
            "Labeled",
            "StackPane",
            "TextField",
            "TilePane",
            "VBox"
        ]
    },
    {
        "name": "-fx-alternative-column-fill-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "XYChart"
        ]
    },
    {
        "name": "-fx-alternative-row-fill-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "XYChart"
        ]
    },
    {
        "name": "-fx-animated",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "TitledPane"
        ]
    },
    {
        "name": "-fx-arc-height",
        "syntax": "<size>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Rectangle"
        ]
    },
    {
        "name": "-fx-arc-width",
        "syntax": "<size>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Rectangle"
        ]
    },
    {
        "name": "-fx-arrows-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "Pagination"
        ]
    },
    {
        "name": "-fx-background-color",
        "syntax": "<paint> [ , <paint> ]*",
        "defaultValue": "transparent",
        "description": "A series of paint values separated by commas.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-background-image",
        "syntax": "<uri> [ , <uri> ]*",
        "defaultValue": "null",
        "description": "A series of image URIs separated by commas.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-background-insets",
        "syntax": "<size> | <size> <size> <size> <size> [ , [ <size> | <size> <size> <size> <size> ] ]*",
        "defaultValue": "0 0 0 0",
        "description": "A series of size values or sets of four size values, separated by commas. A single size value means all insets are the same. Otherwise, the four values for each inset are given in the order top, right, bottom, left. Each comma-separated value or set of values in the series applies to the corresponding background color.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-background-position",
        "syntax": "<bg-position> [ , <bg-position> ]* where <bg-position> = [ [ [ <size> | left | center | right ] [ <size> | top | center | bottom ]? ] | [ [ center | [ left | right ] <size> ? ] || [ center | [ top | bottom ] <size> ? ] ]",
        "defaultValue": "0% 0%",
        "description": "A series of <bg-position> values separated by commas. Each bg-position item in the series applies to the corresponding image in the background-image series.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-background-radius",
        "syntax": "[ <size> ]{1,4} [ / [ <size> ]{1,4} ]? [ , [ <size> ]{1,4} [ / [ <size> ]{1,4} ]? ]*",
        "defaultValue": "0 0 0 0",
        "description": "The same syntax and semantics as CSS Backgrounds and Borders Module Level 3: Curve Radii applies to -fx-background-radius. Note that JavaFX supports only the short-hand syntax. Each comma-separated value or set of values in the series applies to the corresponding background color.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-background-repeat",
        "syntax": "<repeat-style> [ , <repeat-style> ]* where <repeat-style> = repeat-x | repeat-y | [repeat | space | round | stretch | no-repeat]{1,2}",
        "defaultValue": "repeat repeat",
        "description": "A series of <repeat-style> values separated by commas. Each repeat-style item in the series applies to the corresponding image in the background-image series.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-background-size",
        "syntax": "<bg-size> [ , <bg-size> ]* <bg-size> = [ <size> | auto ]{1,2} | cover | contain | stretch",
        "defaultValue": "auto auto",
        "description": "A series of <bg-size> values separated by commas. Each bg-size item in the series applies to the corresponding image in the background-image series.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-bar-gap",
        "syntax": "<number>",
        "defaultValue": "4",
        "description": "",
        "appliesTo": [
            "BarChart"
        ]
    },
    {
        "name": "-fx-blend-mode",
        "syntax": "[ add | blue | color-burn | color-dodge | darken | difference | exclusion | green | hard-light | lighten | multiply | overlay | red | screen | soft-light | src-atop | src-in | src-out | src-over ]",
        "defaultValue": "null",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-block-increment",
        "syntax": "<number>",
        "defaultValue": "10",
        "description": "",
        "appliesTo": [
            "ScrollBar",
            "Slider"
        ]
    },
    {
        "name": "-fx-border-color",
        "syntax": "<paint> | <paint> <paint> <paint> <paint> [ , [ <paint> | <paint> <paint> <paint> <paint> ] ]*",
        "defaultValue": "null",
        "description": "A series of paint values or sets of four paint values, separated by commas. For each item in the series, if a single paint value is specified, then that paint is used as the border for all sides of the region; and if a set of four paints is specified, they are used for the top, right, bottom, and left borders of the region, in that order. If the border is not rectangular, only the first paint value in the set is used.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-image-insets",
        "syntax": "<size> | <size> <size> <size> <size> [ , [ <size> | <size> <size> <size> <size> ] ]*",
        "defaultValue": "0 0 0 0",
        "description": "A series of inset or sets of four inset values, separated by commas. For each item in the series, a single inset value means that all insets are the same; and if a set of four inset values is specified, they are used for the top, right, bottom, and left edges of the region, in that order. Each item in the series of insets applies to the corresponding image in the series of border images.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-image-repeat",
        "syntax": "<repeat-style> [ , <repeat-style> ]* where <repeat-style> = repeat-x | repeat-y | [repeat | space | round | no-repeat]{1,2}",
        "defaultValue": "repeat repeat",
        "description": "A series of repeat-style values, separated by commas. Each item in the series applies to the corresponding image in the series of border images.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-image-slice",
        "syntax": "[ <size> | <size> <size> <size> <size> ] fill? [ , [ <size> | <size> <size> <size> <size> <size> ] fill? ]*",
        "defaultValue": "100%",
        "description": "A series of image slice values or sets of four values, separated by commas. Each item in the series applies to the corresponding image in the series of border images. For each item in the series, if four values are given, they specify the size of the top, right, bottom, and left slices. This effectively divides the image into nine regions: an upper left corner, a top edge, an upper right corner, a right edge, a lower right corner, a bottom edge, a lower left corner, a left edge and a middle. If one value is specified, this value is used for the slice values for all four edges. If 'fill' is present, the middle slice is preserved, otherwise it is discarded. Percentage values may be used here, in which case the values are considered proportional to the source image.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-image-source",
        "syntax": "<uri> [ , <uri> ]*",
        "defaultValue": "null",
        "description": "A series of image URIs, separated by commas.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-image-width",
        "syntax": "<size> | <size> <size> <size> <size> [ , [ <size> | <size> <size> <size> <size> ] ]*",
        "defaultValue": "1 1 1 1",
        "description": "A series of width or sets of four width values, separated by commas. For each item in the series, a single width value means that all border widths are the same; and if a set of four width values is specified, they are used for the top, right, bottom, and left border widths, in that order. If the border is not rectangular, only the first width value is used. Each item in the series of widths applies to the corresponding item in the series of border images. Percentage values may be used here, in which case the values are considered proportional to the border image area.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-insets",
        "syntax": "<size> | <size> <size> <size> <size> [ , [ <size> | <size> <size> <size> <size> ] ]*",
        "defaultValue": "null",
        "description": "A series of inset or sets of four inset values, separated by commas. For each item in the series, a single inset value means that all insets are the same; and if a set of four inset values is specified, they are used for the top, right, bottom, and left edges of the region, in that order. Each item in the series of insets applies to the corresponding item in the series of border colors.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-radius",
        "syntax": "[ <size> ]{1,4} [ / [ <size> ]{1,4} ]? [ , [ <size> ]{1,4} [ / [ <size> ]{1,4} ]? ]*",
        "defaultValue": "null",
        "description": "Refer to CSS Backgrounds and Borders Module Level 3: Curve Radii . JavaFX supports only the short-hand syntax. Each comma-separated value or set of values in the series applies to the corresponding border color.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-style",
        "syntax": "<border-style> [ , <border-style> ]* where <border-style> = <dash-style> [phase <number>]? [centered | inside | outside]? [line-join [miter <number> | bevel | round]]? [line-cap [square | butt | round]]? where <dash-style> = [ none | solid | dotted | dashed | segments( <number>, <number> [, <number>]*) ]",
        "defaultValue": "null",
        "description": "A series of border style values, separated by commas. Each item in the series applies to the corresponding item in the series of border colors. The segments dash-style defines a sequence representing the lengths of the dash segments. Alternate entries in the sequence represent the lengths of the opaque and transparent segments of the dashes. This corresponds to the strokeDashArray variable of Shape. The optional phase parameter defines the point in the dashing pattern that will correspond to the beginning of the stroke. This corresponds to the strokeDashOffset variable of Shape.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-border-width",
        "syntax": "<size> | <size> <size> <size> <size> [ , [ <size> | <size> <size> <size> <size> ] ]*",
        "defaultValue": "null",
        "description": "A series of width or sets of four width values, separated by commas. For each item in the series, a single width value means that all border widths are the same; and if a set of four width values is specified, they are used for the top, right, bottom, and left border widths, in that order. If the border is not rectangular, only the first width value is used. Each item in the series of widths applies to the corresponding item in the series of border colors.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-bounds-type",
        "syntax": "<text-bounds>",
        "defaultValue": "logical",
        "description": "",
        "appliesTo": [
            "Text"
        ]
    },
    {
        "name": "-fx-caret-blink-period",
        "syntax": "<duration>",
        "defaultValue": "1000 ms",
        "description": "Determines the caret blink period.",
        "appliesTo": [
            "RichTextArea"
        ]
    },
    {
        "name": "-fx-category-gap",
        "syntax": "<number>",
        "defaultValue": "10",
        "description": "",
        "appliesTo": [
            "BarChart"
        ]
    },
    {
        "name": "-fx-cell-size",
        "syntax": "<size>",
        "defaultValue": "24",
        "description": "The cell size. For vertical ListView or a TreeView or TableView this is the height, for a horizontal ListView this is the width.",
        "appliesTo": [
            "Cell"
        ]
    },
    {
        "name": "-fx-clockwise",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "PieChart"
        ]
    },
    {
        "name": "-fx-close-tab-animation",
        "syntax": "[ grow | none ]",
        "defaultValue": "grow",
        "description": "'none' disables Tab closing animation",
        "appliesTo": [
            "TabPane"
        ]
    },
    {
        "name": "-fx-collapsible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "TitledPane"
        ]
    },
    {
        "name": "-fx-color-label-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "ColorPicker"
        ]
    },
    {
        "name": "-fx-column-halignment",
        "syntax": "[ left | center | right ]",
        "defaultValue": "left",
        "description": "",
        "appliesTo": [
            "FlowPane"
        ]
    },
    {
        "name": "-fx-content-display",
        "syntax": "[ top | right | bottom | left | center | right | graphic-only | text-only ]",
        "defaultValue": "left",
        "description": "",
        "appliesTo": [
            "Labeled",
            "Tooltip"
        ]
    },
    {
        "name": "-fx-content-padding",
        "syntax": "<size> | <size> <size> <size> <size>",
        "defaultValue": "0 0 0 0",
        "description": "Amount of padding in the content area.",
        "appliesTo": [
            "RichTextArea"
        ]
    },
    {
        "name": "-fx-context-menu-enabled",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-create-symbols",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "LineChart"
        ]
    },
    {
        "name": "-fx-cursor",
        "syntax": "[ null | crosshair | default | hand | move | e-resize | h-resize | ne-resize | nw-resize | n-resize | se-resize | sw-resize | s-resize | w-resize | v-resize | text | wait ] | <url>",
        "defaultValue": "null",
        "description": "inherits",
        "appliesTo": [
            "Hyperlink",
            "Node"
        ]
    },
    {
        "name": "-fx-display-caret",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "Determines whether the caret is displayed.",
        "appliesTo": [
            "RichTextArea",
            "TextInputControl"
        ]
    },
    {
        "name": "-fx-effect",
        "syntax": "<effect>",
        "defaultValue": "null",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-ellipsis-string",
        "syntax": "<string>",
        "defaultValue": "...",
        "description": "",
        "appliesTo": [
            "Labeled"
        ]
    },
    {
        "name": "-fx-end-margin",
        "syntax": "<number>",
        "defaultValue": "5",
        "description": "The margin between the axis start and the first tick-mark",
        "appliesTo": [
            "CategoryAxis"
        ]
    },
    {
        "name": "-fx-fill",
        "syntax": "<paint>",
        "defaultValue": "BLACK",
        "description": "text color",
        "appliesTo": [
            "Line",
            "Path",
            "Shape",
            "Text"
        ]
    },
    {
        "name": "-fx-fill-height",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "HBox"
        ]
    },
    {
        "name": "-fx-fill-width",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "VBox"
        ]
    },
    {
        "name": "-fx-fit-height",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "The height of the bounding box within which the source image is resized as necessary to fit.",
        "appliesTo": [
            "ImageView"
        ]
    },
    {
        "name": "-fx-fit-to-height",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "ScrollPane"
        ]
    },
    {
        "name": "-fx-fit-to-width",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "ScrollPane"
        ]
    },
    {
        "name": "-fx-fit-width",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "The width of the bounding box within which the source image is resized as necessary to fit.",
        "appliesTo": [
            "ImageView"
        ]
    },
    {
        "name": "-fx-fixed-cell-size",
        "syntax": "<size>",
        "defaultValue": "-1",
        "description": "A value greater than zero sets the fixed cell size of the table. A value of zero or less disables fixed cell size.",
        "appliesTo": [
            "TableView",
            "TreeView"
        ]
    },
    {
        "name": "-fx-focus-traversable",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "Control sets the default value of the focusTraversable property to true. The default value of the focusTraversable property for the following controls is false: Accordion, Cell, Label, MenuBar, ProgressBar, ProgressIndicator, ScrollBar, ScrollPane, Separator, SplitPane, ToolBar.",
        "appliesTo": [
            "Control",
            "Node"
        ]
    },
    {
        "name": "-fx-font",
        "syntax": "<font>",
        "defaultValue": "inherit",
        "description": "shorthand property for font-size, font-family, font-weight and font-style",
        "appliesTo": [
            "CodeArea",
            "Font Properties",
            "Labeled",
            "Text",
            "TextInputControl",
            "Tooltip"
        ]
    },
    {
        "name": "-fx-font-family",
        "syntax": "<font-family>",
        "defaultValue": "inherit",
        "description": "",
        "appliesTo": [
            "Font Properties"
        ]
    },
    {
        "name": "-fx-font-scale",
        "syntax": "<number>",
        "defaultValue": "1",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-font-size",
        "syntax": "<font-size>",
        "defaultValue": "inherit",
        "description": "",
        "appliesTo": [
            "Font Properties"
        ]
    },
    {
        "name": "-fx-font-smoothing-type",
        "syntax": "[ gray | lcd ]",
        "defaultValue": "gray",
        "description": "",
        "appliesTo": [
            "Text",
            "WebView"
        ]
    },
    {
        "name": "-fx-font-style",
        "syntax": "<font-style>",
        "defaultValue": "inherit",
        "description": "",
        "appliesTo": [
            "Font Properties"
        ]
    },
    {
        "name": "-fx-font-weight",
        "syntax": "<font-weight>",
        "defaultValue": "inherit",
        "description": "",
        "appliesTo": [
            "Font Properties"
        ]
    },
    {
        "name": "-fx-gap-start-and-end",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "If this is true then half the space between ticks is left at the start and end",
        "appliesTo": [
            "CategoryAxis"
        ]
    },
    {
        "name": "-fx-graphic",
        "syntax": "<uri>",
        "defaultValue": "null",
        "description": "",
        "appliesTo": [
            "DialogPane",
            "Labeled",
            "Tooltip"
        ]
    },
    {
        "name": "-fx-graphic-text-gap",
        "syntax": "<size>",
        "defaultValue": "4",
        "description": "",
        "appliesTo": [
            "Labeled",
            "Tooltip"
        ]
    },
    {
        "name": "-fx-grid-lines-visible",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "GridPane"
        ]
    },
    {
        "name": "-fx-halignment",
        "syntax": "[ left | center | right ]",
        "defaultValue": "center",
        "description": "",
        "appliesTo": [
            "Separator"
        ]
    },
    {
        "name": "-fx-hbar-policy",
        "syntax": "[ never | always | as-needed ]",
        "defaultValue": "as-needed",
        "description": "",
        "appliesTo": [
            "ScrollPane"
        ]
    },
    {
        "name": "-fx-hgap",
        "syntax": "<size>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "FlowPane",
            "GridPane",
            "TilePane"
        ]
    },
    {
        "name": "-fx-hide-delay",
        "syntax": "<duration>",
        "defaultValue": "200ms",
        "description": "",
        "appliesTo": [
            "Tooltip"
        ]
    },
    {
        "name": "-fx-highlight-current-paragraph",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "Determines whether the current paragraph is highlighted.",
        "appliesTo": [
            "RichTextArea"
        ]
    },
    {
        "name": "-fx-highlight-fill",
        "syntax": "<paint>",
        "defaultValue": "dodgerblue",
        "description": "",
        "appliesTo": [
            "TextInputControl"
        ]
    },
    {
        "name": "-fx-highlight-text-fill",
        "syntax": "<paint>",
        "defaultValue": "white",
        "description": "",
        "appliesTo": [
            "TextInputControl"
        ]
    },
    {
        "name": "-fx-horizontal-grid-lines-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "XYChart"
        ]
    },
    {
        "name": "-fx-horizontal-zero-line-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "XYChart"
        ]
    },
    {
        "name": "-fx-image",
        "syntax": "<uri>",
        "defaultValue": "null",
        "description": "Relative URLs are resolved against the URL of the stylesheet.",
        "appliesTo": [
            "ImageView"
        ]
    },
    {
        "name": "-fx-indent",
        "syntax": "<size>",
        "defaultValue": "10",
        "description": "The amount of space to multiply by the treeItem.level to get the left margin",
        "appliesTo": [
            "TreeCell"
        ]
    },
    {
        "name": "-fx-indeterminate-bar-animation-time",
        "syntax": "<number>",
        "defaultValue": "2.0",
        "description": "",
        "appliesTo": [
            "ProgressBar"
        ]
    },
    {
        "name": "-fx-indeterminate-bar-escape",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "ProgressBar"
        ]
    },
    {
        "name": "-fx-indeterminate-bar-flip",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "ProgressBar"
        ]
    },
    {
        "name": "-fx-indeterminate-bar-length",
        "syntax": "<number>",
        "defaultValue": "60",
        "description": "",
        "appliesTo": [
            "ProgressBar"
        ]
    },
    {
        "name": "-fx-indeterminate-segment-count",
        "syntax": "<number>",
        "defaultValue": "8",
        "description": "",
        "appliesTo": [
            "ProgressIndicator"
        ]
    },
    {
        "name": "-fx-initial-delay",
        "syntax": "<duration>",
        "defaultValue": "300ms",
        "description": "",
        "appliesTo": [
            "Spinner"
        ]
    },
    {
        "name": "-fx-label-line-length",
        "syntax": "<size>",
        "defaultValue": "20",
        "description": "",
        "appliesTo": [
            "PieChart"
        ]
    },
    {
        "name": "-fx-label-padding",
        "syntax": "<size> | <size> <size> <size> <size>",
        "defaultValue": "[0,0,0,0]",
        "description": "",
        "appliesTo": [
            "Labeled"
        ]
    },
    {
        "name": "-fx-legend-side",
        "syntax": "Side",
        "defaultValue": "bottom",
        "description": "",
        "appliesTo": [
            "Chart"
        ]
    },
    {
        "name": "-fx-legend-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "Chart"
        ]
    },
    {
        "name": "-fx-line-spacing",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "CodeArea",
            "Text",
            "TextFlow"
        ]
    },
    {
        "name": "-fx-major-tick-unit",
        "syntax": "<number>",
        "defaultValue": "25",
        "description": "",
        "appliesTo": [
            "Slider"
        ]
    },
    {
        "name": "-fx-managed",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-max-height",
        "syntax": "<size>",
        "defaultValue": "Double.MAX_VALUE",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-max-page-indicator-count",
        "syntax": "<number>",
        "defaultValue": "10",
        "description": "",
        "appliesTo": [
            "Pagination"
        ]
    },
    {
        "name": "-fx-max-width",
        "syntax": "<size>",
        "defaultValue": "Double.MAX_VALUE",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-min-height",
        "syntax": "<size>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-min-height, -fx-pref-height, -fx-max-height",
        "syntax": "<size>",
        "defaultValue": "-1",
        "description": "Percentage values are not useful since the actual value would be computed from the width and/or height of the Region's parent before the parent is laid out.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-min-width",
        "syntax": "<size>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-min-width, -fx-pref-width, -fx-max-width",
        "syntax": "<size>",
        "defaultValue": "-1",
        "description": "Percentage values are not useful since the actual value would be computed from the width and/or height of the Region's parent before the parent is laid out.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-minor-tick-count",
        "syntax": "<integer>",
        "defaultValue": "3",
        "description": "",
        "appliesTo": [
            "Slider",
            "ValueAxis"
        ]
    },
    {
        "name": "-fx-minor-tick-length",
        "syntax": "<size>",
        "defaultValue": "5",
        "description": "",
        "appliesTo": [
            "ValueAxis"
        ]
    },
    {
        "name": "-fx-minor-tick-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "ValueAxis"
        ]
    },
    {
        "name": "-fx-opacity",
        "syntax": "<number>",
        "defaultValue": "1",
        "description": "[0.0 ... 1.0]",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-open-tab-animation",
        "syntax": "[ grow | none ]",
        "defaultValue": "grow",
        "description": "'none' disables Tab opening animation",
        "appliesTo": [
            "TabPane"
        ]
    },
    {
        "name": "-fx-orientation",
        "syntax": "[ horizontal | vertical ]",
        "defaultValue": "horizontal",
        "description": "",
        "appliesTo": [
            "FlowPane",
            "ListView",
            "ScrollBar",
            "Separator",
            "Slider",
            "SplitPane",
            "TilePane",
            "ToolBar"
        ]
    },
    {
        "name": "-fx-padding",
        "syntax": "<size> | <size> <size> <size> <size>",
        "defaultValue": "0 0 0 0",
        "description": "A sets of four padding values, separated by commas. For each item in the series, a single padding value means that all padding are the same; and if a set of four padding values is specified, they are used for the top, right, bottom, and left edges of the region, in that order.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-page-fill",
        "syntax": "<color>",
        "defaultValue": "white",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-page-information-alignment",
        "syntax": "[ top | bottom | left | right ]",
        "defaultValue": "bottom",
        "description": "",
        "appliesTo": [
            "Pagination"
        ]
    },
    {
        "name": "-fx-page-information-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "Pagination"
        ]
    },
    {
        "name": "-fx-pannable",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "ScrollPane"
        ]
    },
    {
        "name": "-fx-pie-label-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "PieChart"
        ]
    },
    {
        "name": "-fx-position-shape",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "If true means the shape centered within the region's width and height, otherwise the shape is positioned at its source position. Has no effect if a shape string is not specified.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-pref-column-count",
        "syntax": "number",
        "defaultValue": "40",
        "description": "",
        "appliesTo": [
            "TextArea",
            "TextField"
        ]
    },
    {
        "name": "-fx-pref-columns",
        "syntax": "<integer>",
        "defaultValue": "5",
        "description": "",
        "appliesTo": [
            "TilePane"
        ]
    },
    {
        "name": "-fx-pref-height",
        "syntax": "<size>",
        "defaultValue": "600",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-pref-row-count",
        "syntax": "number",
        "defaultValue": "10",
        "description": "",
        "appliesTo": [
            "TextArea"
        ]
    },
    {
        "name": "-fx-pref-rows",
        "syntax": "<integer>",
        "defaultValue": "5",
        "description": "",
        "appliesTo": [
            "TilePane"
        ]
    },
    {
        "name": "-fx-pref-tile-height",
        "syntax": "<size>",
        "defaultValue": "-1",
        "description": "",
        "appliesTo": [
            "TilePane"
        ]
    },
    {
        "name": "-fx-pref-tile-width",
        "syntax": "<size>",
        "defaultValue": "-1",
        "description": "",
        "appliesTo": [
            "TilePane"
        ]
    },
    {
        "name": "-fx-pref-width",
        "syntax": "<size>",
        "defaultValue": "800",
        "description": "",
        "appliesTo": [
            "WebView"
        ]
    },
    {
        "name": "-fx-preserve-ratio",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "Indicates whether to preserve the aspect ratio of the source image when scaling to fit the image within the fitting bounding box.",
        "appliesTo": [
            "ImageView"
        ]
    },
    {
        "name": "-fx-progress-color",
        "syntax": "<paint>",
        "defaultValue": "null",
        "description": "",
        "appliesTo": [
            "ProgressIndicator"
        ]
    },
    {
        "name": "-fx-prompt-text-fill",
        "syntax": "<paint>",
        "defaultValue": "gray",
        "description": "",
        "appliesTo": [
            "TextInputControl"
        ]
    },
    {
        "name": "-fx-region-background",
        "syntax": "javafx.scene.layout.Background",
        "defaultValue": "null",
        "description": "This cannot be set directly from CSS but is created from the property values of -fx-background-color, -fx-background-image, -fx-background-insets, -fx-background-position, -fx-background-radius, -fx-background-repeat, -fx-background-size",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-region-border",
        "syntax": "javafx.scene.layout.Border",
        "defaultValue": "null",
        "description": "This cannot be set directly from CSS but is created from the property values of -fx-border-color, -fx-border-insets, -fx-border-radius, -fx-border-style, -fx-border-width, -fx-border-image-insets, -fx-border-image-repeat, -fx-border-image-slice, -fx-border-image-source, -fx-border-image-width",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-repeat-delay",
        "syntax": "<duration>",
        "defaultValue": "60ms",
        "description": "",
        "appliesTo": [
            "Spinner"
        ]
    },
    {
        "name": "-fx-rotate",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-row-valignment",
        "syntax": "[ top | center | baseline | bottom ]",
        "defaultValue": "center",
        "description": "",
        "appliesTo": [
            "FlowPane"
        ]
    },
    {
        "name": "-fx-scale-shape",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "If true means the shape is scaled to fit the size of the region, otherwise the shape is at its source size, and its position depends on the value of the position-shape property. Has no effect if a shape string is not specified.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-scale-x",
        "syntax": "<number>",
        "defaultValue": "1",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-scale-y",
        "syntax": "<number>",
        "defaultValue": "1",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-scale-z",
        "syntax": "<number>",
        "defaultValue": "1",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-shape",
        "syntax": "\" <string> \"",
        "defaultValue": "null",
        "description": "An SVG path string. By specifying a shape here the region takes on that shape instead of a rectangle or rounded rectangle. The syntax of this path string is specified in [3] .",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-show-delay",
        "syntax": "<duration>",
        "defaultValue": "1000ms",
        "description": "",
        "appliesTo": [
            "Tooltip"
        ]
    },
    {
        "name": "-fx-show-duration",
        "syntax": "<duration>",
        "defaultValue": "5000ms",
        "description": "",
        "appliesTo": [
            "Tooltip"
        ]
    },
    {
        "name": "-fx-show-tick-labels",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "Slider"
        ]
    },
    {
        "name": "-fx-show-tick-marks",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "Slider"
        ]
    },
    {
        "name": "-fx-show-week-numbers",
        "syntax": "<boolean>",
        "defaultValue": "true if the resource bundle property \"DatePicker.showWeekNumbers\" contains the country code.",
        "description": "",
        "appliesTo": [
            "DatePicker"
        ]
    },
    {
        "name": "-fx-side",
        "syntax": "Side",
        "defaultValue": "null",
        "description": "",
        "appliesTo": [
            "Axis"
        ]
    },
    {
        "name": "-fx-size",
        "syntax": "<size>",
        "defaultValue": "20",
        "description": "The table column header size.",
        "appliesTo": [
            "TableColumnHeader"
        ]
    },
    {
        "name": "-fx-skin",
        "syntax": "<string>",
        "defaultValue": "null",
        "description": "The class name of the Control's Skin.",
        "appliesTo": [
            "Control"
        ]
    },
    {
        "name": "-fx-smooth",
        "syntax": "<boolean>",
        "defaultValue": "Platform-specific",
        "description": "Indicates whether to use a better quality filtering algorithm or a faster one when transforming or scaling the source image to fit.",
        "appliesTo": [
            "ImageView",
            "Shape"
        ]
    },
    {
        "name": "-fx-snap-to-pixel",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "Defines whether this region rounds position/spacing and ceils size values to pixel boundaries when laying out its children.",
        "appliesTo": [
            "Region"
        ]
    },
    {
        "name": "-fx-snap-to-ticks",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "Slider"
        ]
    },
    {
        "name": "-fx-spacing",
        "syntax": "<size>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "HBox",
            "VBox"
        ]
    },
    {
        "name": "-fx-spin-enabled",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "ProgressIndicator"
        ]
    },
    {
        "name": "-fx-start-angle",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "PieChart"
        ]
    },
    {
        "name": "-fx-start-margin",
        "syntax": "<number>",
        "defaultValue": "5",
        "description": "The margin between the axis start and the first tick-mark",
        "appliesTo": [
            "CategoryAxis"
        ]
    },
    {
        "name": "-fx-strikethrough",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "Text"
        ]
    },
    {
        "name": "-fx-stroke",
        "syntax": "<paint>",
        "defaultValue": "null",
        "description": "",
        "appliesTo": [
            "Line",
            "Path",
            "Shape"
        ]
    },
    {
        "name": "-fx-stroke-dash-array",
        "syntax": "<size> [ <size> ]+",
        "defaultValue": "see comment",
        "description": "The initial value is that of an empty array, effectively a solid line.",
        "appliesTo": [
            "Shape"
        ]
    },
    {
        "name": "-fx-stroke-dash-offset",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Shape"
        ]
    },
    {
        "name": "-fx-stroke-line-cap",
        "syntax": "[ square | butt | round ]",
        "defaultValue": "square",
        "description": "",
        "appliesTo": [
            "Shape"
        ]
    },
    {
        "name": "-fx-stroke-line-join",
        "syntax": "[ miter | bevel | round ]",
        "defaultValue": "miter",
        "description": "",
        "appliesTo": [
            "Shape"
        ]
    },
    {
        "name": "-fx-stroke-miter-limit",
        "syntax": "<number>",
        "defaultValue": "10",
        "description": "",
        "appliesTo": [
            "Shape"
        ]
    },
    {
        "name": "-fx-stroke-type",
        "syntax": "[ inside | outside | centered ]",
        "defaultValue": "centered",
        "description": "",
        "appliesTo": [
            "Shape"
        ]
    },
    {
        "name": "-fx-stroke-width",
        "syntax": "<size>",
        "defaultValue": "1",
        "description": "",
        "appliesTo": [
            "Shape"
        ]
    },
    {
        "name": "-fx-tab-max-height",
        "syntax": "<integer>",
        "defaultValue": "Double.MAX_VALUE",
        "description": "",
        "appliesTo": [
            "TabPane"
        ]
    },
    {
        "name": "-fx-tab-max-width",
        "syntax": "<integer>",
        "defaultValue": "Double.MAX_VALUE",
        "description": "",
        "appliesTo": [
            "TabPane"
        ]
    },
    {
        "name": "-fx-tab-min-height",
        "syntax": "<integer>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "TabPane"
        ]
    },
    {
        "name": "-fx-tab-min-width",
        "syntax": "<integer>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "TabPane"
        ]
    },
    {
        "name": "-fx-tab-size",
        "syntax": "<integer>",
        "defaultValue": "8",
        "description": "",
        "appliesTo": [
            "CodeArea",
            "Text",
            "TextFlow"
        ]
    },
    {
        "name": "-fx-text-alignment",
        "syntax": "[ left | center | right | justify ]",
        "defaultValue": "left",
        "description": "inherits",
        "appliesTo": [
            "Labeled",
            "Text",
            "TextFlow",
            "Tooltip"
        ]
    },
    {
        "name": "-fx-text-fill",
        "syntax": "<paint>",
        "defaultValue": "black",
        "description": "",
        "appliesTo": [
            "Labeled",
            "TextInputControl"
        ]
    },
    {
        "name": "-fx-text-origin",
        "syntax": "[ baseline | top | bottom ]",
        "defaultValue": "baseline",
        "description": "",
        "appliesTo": [
            "Text"
        ]
    },
    {
        "name": "-fx-text-overrun",
        "syntax": "[ center-ellipsis | center-word-ellipsis | clip | ellipsis | leading-ellipsis | leading-word-ellipsis | word-ellipsis ]",
        "defaultValue": "ellipsis",
        "description": "",
        "appliesTo": [
            "Labeled",
            "Tooltip"
        ]
    },
    {
        "name": "-fx-tick-label-fill",
        "syntax": "<paint>",
        "defaultValue": "black",
        "description": "",
        "appliesTo": [
            "Axis"
        ]
    },
    {
        "name": "-fx-tick-label-font",
        "syntax": "<font>",
        "defaultValue": "8 system",
        "description": "",
        "appliesTo": [
            "Axis"
        ]
    },
    {
        "name": "-fx-tick-label-gap",
        "syntax": "<size>",
        "defaultValue": "3",
        "description": "",
        "appliesTo": [
            "Axis"
        ]
    },
    {
        "name": "-fx-tick-labels-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "Axis"
        ]
    },
    {
        "name": "-fx-tick-length",
        "syntax": "<size>",
        "defaultValue": "8",
        "description": "",
        "appliesTo": [
            "Axis"
        ]
    },
    {
        "name": "-fx-tick-mark-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "Axis"
        ]
    },
    {
        "name": "-fx-tick-unit",
        "syntax": "<number>",
        "defaultValue": "5",
        "description": "The value between each major tick mark in data units.",
        "appliesTo": [
            "NumberAxis"
        ]
    },
    {
        "name": "-fx-tile-alignment",
        "syntax": "[ top-left | top-center | top-right | center-left | center | center-right | bottom-left | bottom-center | bottom-right | baseline-left | baseline-center | baseline-right ]",
        "defaultValue": "center",
        "description": "",
        "appliesTo": [
            "TilePane"
        ]
    },
    {
        "name": "-fx-title-side",
        "syntax": "Side",
        "defaultValue": "top",
        "description": "",
        "appliesTo": [
            "Chart"
        ]
    },
    {
        "name": "-fx-tooltip-visible",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "When set to true, a tooltip which shows the page number is set on the page indicators. This property controls whether or not the tooltip is visible on the page indicators and does not affect the visibility of the tooltip set or installed on the Pagination control itself.",
        "appliesTo": [
            "Pagination"
        ]
    },
    {
        "name": "-fx-translate-x",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-translate-y",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-translate-z",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-underline",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "Labeled",
            "Text"
        ]
    },
    {
        "name": "-fx-unit-increment",
        "syntax": "<number>",
        "defaultValue": "1",
        "description": "",
        "appliesTo": [
            "ScrollBar"
        ]
    },
    {
        "name": "-fx-use-content-height",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "Determines whether the preferred height is the same as the content height.",
        "appliesTo": [
            "RichTextArea"
        ]
    },
    {
        "name": "-fx-use-content-width",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "Determines whether the preferred width is the same as the content width.",
        "appliesTo": [
            "RichTextArea"
        ]
    },
    {
        "name": "-fx-use-system-menu-bar",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "",
        "appliesTo": [
            "MenuBar"
        ]
    },
    {
        "name": "-fx-valignment",
        "syntax": "[ top | center | baseline | bottom ]",
        "defaultValue": "center",
        "description": "",
        "appliesTo": [
            "Separator"
        ]
    },
    {
        "name": "-fx-vbar-policy",
        "syntax": "[ never | always | as-needed ]",
        "defaultValue": "as-needed",
        "description": "",
        "appliesTo": [
            "ScrollPane"
        ]
    },
    {
        "name": "-fx-vertical-grid-lines-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "XYChart"
        ]
    },
    {
        "name": "-fx-vertical-zero-line-visible",
        "syntax": "<boolean>",
        "defaultValue": "true",
        "description": "",
        "appliesTo": [
            "XYChart"
        ]
    },
    {
        "name": "-fx-vgap",
        "syntax": "<size>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "FlowPane",
            "GridPane",
            "TilePane"
        ]
    },
    {
        "name": "-fx-view-order",
        "syntax": "<number>",
        "defaultValue": "0",
        "description": "",
        "appliesTo": [
            "Node"
        ]
    },
    {
        "name": "-fx-wrap-text",
        "syntax": "<boolean>",
        "defaultValue": "false",
        "description": "Determines whether text should be wrapped.",
        "appliesTo": [
            "Labeled",
            "RichTextArea",
            "TextArea",
            "Tooltip"
        ]
    }
];
