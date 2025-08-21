# XML Language Features

This extension provides comprehensive language support for XML files in VS Code, including:

## Features

### ✨ Document Formatting
- **Full document formatting**: Format entire XML documents with proper indentation
- **Range formatting**: Format selected portions of XML documents
- **Configurable options**:
  - Indent size (tabs or spaces)
  - Preserve new lines
  - Maximum preserved new lines
  - Attribute wrapping styles

### 🎯 Language Services
- **Syntax highlighting**: Enhanced syntax highlighting for XML and XSL files
- **Auto-completion**: Basic completion support for XML elements and attributes
- **Document validation**: Basic XML validation
- **Hover information**: Documentation on hover (extensible)
- **Document symbols**: Navigate through document structure
- **Folding ranges**: Collapse/expand XML elements

## Configuration

The extension can be configured through VS Code settings:

```json
{
  "xml.format.enable": true,
  "xml.format.wrapLineLength": 120,
  "xml.format.preserveNewLines": true,
  "xml.format.maxPreserveNewLines": null,
  "xml.format.indentInnerXml": false,
  "xml.format.wrapAttributes": "auto",
  "xml.format.wrapAttributesIndentSize": null,
  "xml.suggest.enabled": true,
  "xml.validate.enabled": true,
  "xml.autoClosingTags": true,
  "xml.hover.documentation": true
}
```

## Supported File Types

This extension supports the following file extensions:
- `.xml` - XML documents
- `.xsl`, `.xslt` - XSL Transformations
- `.xsd` - XML Schema Documents
- `.svg` - Scalable Vector Graphics
- And many more XML-based formats

## Usage

### Formatting
- **Format Document**: `Shift+Alt+F` (Windows/Linux) or `Shift+Option+F` (Mac)
- **Format Selection**: Select text and use `Shift+Alt+F`

### Configuration
Access settings through:
1. File → Preferences → Settings
2. Search for "xml"
3. Configure the XML language features options

## Architecture

This extension follows the Language Server Protocol (LSP) architecture:
- **Client**: Handles VS Code integration and user interface
- **Server**: Provides language services (formatting, validation, completion)

The architecture is consistent with other VS Code language features extensions like `html-language-features`.

## Development

The extension is built with:
- TypeScript
- VS Code Extension API
- Language Server Protocol
- Node.js for the language server

## License

MIT - See LICENSE file for details