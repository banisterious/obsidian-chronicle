# ScribeFlow - Structured Journal Entries for Obsidian

A modern Obsidian plugin for creating structured journal entries with dream diary tracking, customizable metrics, and smart image management.

## Features

### 📝 **Structured Journal Entries**
- Clean tabbed interface with journal entry and dream diary sections
- Real-time word count tracking
- Auto-save form state between sessions

### 🌙 **Dream Diary Integration**
- Dedicated dream tracking with title, content, and detailed metrics
- 18+ customizable dream metrics (sensory detail, emotional recall, lucidity, etc.)
- Reference tabs with inspirations and metric descriptions

### 🖼️ **Smart Image Management**
- Folder autosuggester for organizing images
- Customizable file type filtering (PNG, JPG, SVG, etc.)
- Resizable image previews with persistent sizing

### ⚙️ **Flexible Settings**
- Customizable callout names for journal and dream entries
- Unlimited selectable metrics with drag-to-reorder
- Settings available both in plugin settings and modal interface

### 📋 **Template System** *(New in 0.4.0-alpha)*
- **Template Management** - Create, edit, copy, and delete custom journal templates
- **Creation Wizard** - 3-step guided workflow for template creation
- **Plugin Integration** - Import templates from Templater and Core Templates plugins
- **Predefined Structures** - Ready-to-use templates for common journal layouts
- **Interactive Placeholders** - Dropdown selector for easy placeholder insertion
- **Dynamic Processing** - Automatic word counting and metrics formatting

### 🔗 **Automatic Table of Contents**
- Smart TOC link generation for year notes and master journals
- Dual toggle controls for independent update modes
- Specific callout targeting with customizable names
- Automatic dream diary sub-links when dreams are included

<p align="left">
  <img src="docs/images/scribeflow-journal-entry-01.png" alt="ScribeFlow journal entry example" width="300"/>
</p>

<p align="left"><em>ScribeFlow journal entry example</em></p>

## Quick Start

1. **Access ScribeFlow**: Right-click in any note → "ScribeFlow: insert journal entry"
2. **Choose Template**: Select from existing templates or use the default format
3. **Create Entry**: Fill in your journal content and optionally add dream details
4. **Add Images**: Use the smart image picker with folder and file type filtering
5. **Create Templates**: Use the "Journal Structures" tab to create custom templates
6. **Configure**: Customize metrics, callout names, and image preferences in settings

## Settings

- **Callout Names**: Customize the names used for journal-entry and dream-diary callouts
- **Table of Contents**: Configure automatic TOC updates for year notes and master journals
- **Image Folder**: Set default folder for image selection with autosuggester
- **File Types**: Choose which image formats to show in the picker (PNG, JPG, SVG, etc.)
- **Dream Metrics**: Select and reorder up to any number of dream tracking metrics

## Output Format

Creates structured markdown with:
- Timestamped journal entries using customizable callouts
- Optional dream diary sections with rich metadata
- Embedded images with proper formatting and floating layout
- Comprehensive dream metrics in organized callouts


## Installation

**Recommended: Use BRAT Plugin**
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Open BRAT settings → "Add Beta Plugin"
3. Enter: `banisterious/obsidian-scribeflow`
4. Click "Add Plugin" and enable ScribeFlow

**Alternative: Manual Installation**
Download the latest release from [GitHub](https://github.com/banisterious/obsidian-scribeflow/releases) and extract to your `.obsidian/plugins/` folder.

---

## Support My Work

If you find this plugin useful, please consider supporting its development at https://github.com/sponsors/banisterious.

Or:

<a href="https://www.buymeacoffee.com/banisterious" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

## License

MIT License - see [LICENSE](LICENSE) for details.
