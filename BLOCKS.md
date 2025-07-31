# Blocks Specification

## Teaser Block

### Visually destinctive variants that we test ATM

- Image Alignment: center, left, right
- Background Color: white, grey
- Link Target: Page, News Item, Event, Link, File, Image, Person

### What we do not test ATM (open for debate)

- Minimal versions (we always test a version with every field filled out)
  - Just a title
  - Just a kicker
  - Just a description
  - Just an image
- Internal / External Links (we just test internal links for now)

### Teaser Block Spec

```
Teaser Block
  ├── Target (href)
  │   └── Widget: object_browser
  │   └── Options:
  │       ├── external link
  │       └── internal link
  |           └── Options
  |               └── Page
  |               └── News Item
  |               └── Event
  |               └── Link
  |               └── File
  |               └── Image
  |               └── Person
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
      └── Image Alignment
          ├── Widget: align
          ├── Options: [left, right, center]
          └── Default: left
      └── Background Color
          ├── Widget: theme-color
          ├── Options: [white, grey]
          └── Default: white
```
