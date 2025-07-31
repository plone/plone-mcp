# Blocks Specification

## Teaser Block

```
Teaser Block
  ├── Target (href)
  │   └── Widget: object_browser
  │
  ├── Customize Teaser Content (overwrite)
  │   ├── Type: boolean
  │   └── Default: false
  │
  ├── Conditional Fields (show when overwrite = true)
  │   ├── Title (title)
  │   │   └── Widget: string
  │   ├── Kicker (head_title)
  │   │   └── Widget: string
  │   ├── Description (description)
  │   │   └── Widget: textarea
  │   └── Image Override (preview_image)
  │       └── Widget: object_browser
  │
  └── Styling Properties
      └── Alignment
          ├── Widget: align
          ├── Options: [left, right, center]
          └── Default: left
      └── Background
          ├── Widget: theme-color
          ├── Options: [white, grey]
          └── Default: white
```
