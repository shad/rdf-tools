# RDF Tools

Transform your Obsidian vault into a semantic knowledge graph! Write RDF data in Turtle format and query it with SPARQL - all within your notes.

## What it does

- 📝 Write **RDF data** using `turtle` code blocks in your notes
- 🔍 **Query your data** with `sparql` code blocks that show live results
- ⚡ **Automatic updates** - query results refresh when you change the data
- 🔗 **Cross-file queries** - query data from multiple notes at once
- 🏷️ **Smart namespaces** - built-in prefixes for common vocabularies

## Quick Start

1. Install the plugin from the Community Plugins store
2. Create a note and add a turtle code block with some RDF data
3. Add a sparql code block to query that data
4. Watch the query results appear automatically!

## Simple Example

Create RDF data about people you know:

### Turtle Data Block
````markdown
```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix : <vault://people/contacts.md/> .

:alice a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:knows :bob .

:bob a foaf:Person ;
    foaf:name "Bob Jones" .
```
````

### SPARQL Query Block
````markdown
```sparql
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?person ?name WHERE {
    ?person a foaf:Person ;
            foaf:name ?name .
}
```
````

## Cross-File Queries

Query data from other files using `FROM` clauses:

````markdown
```sparql
SELECT ?person ?name
FROM <vault://people/contacts.md>
WHERE {
    ?person a foaf:Person ;
            foaf:name ?name .
}
```
````

The results automatically update when you change the data in `contacts.md`!

## Available Graphs

RDF Tools provides multiple types of graphs you can query:

- **📁 File Graphs** (`vault://file.md`) - Your RDF data from turtle blocks
- **📊 Meta Graph** (`meta://`) - Vault structure, file metadata, word counts, links
- **🏗️ Ontology Graph** (`meta://ontology`) - Schema definitions and vocabulary

**→ [Complete Graph Documentation](docs/graphs.md)**

## How it works

### File = Graph
Each markdown file with turtle blocks becomes a named graph:
- `vault://path/file.md` - refers to a specific file
- `vault://folder/` - queries all files in a folder
- `vault://` - queries all files in your vault

### URI Resolution
Use relative URIs within files, absolute URIs across files:
```turtle
@base <vault://people/contacts.md/> .
<alice> foaf:name "Alice" .          # becomes vault://people/contacts.md/alice
```

### Built-in Vocabulary

RDF Tools includes a comprehensive ontology for describing vault structure:

- **Classes**: `vault:Note`, `vault:Directory`, `vault:Attachment`, etc.
- **Properties**: `vault:linksTo`, `vault:contains`, `vault:wordCount`, etc.
- **Metadata**: File sizes, creation dates, link relationships

**→ [Complete Ontology Documentation](docs/ontology.md)**

## Installation

### From Community Plugin Store (Recommended)
1. Open Obsidian Settings → Community Plugins
2. Browse and search for "RDF Tools"
3. Install and enable the plugin

### Development Installation (Building from Source)

Want to try the latest features or contribute to development? Here are several ways to install from source:

#### Method 1: Clone and Build (Recommended for Testing)
```bash
# Navigate to your vault's plugins directory
cd /path/to/your/vault/.obsidian/plugins

# Clone the repository
git clone https://github.com/shad/rdf-tools.git
cd rdf-tools

# Install dependencies and build
npm install
npm run build

# Enable the plugin in Obsidian Settings → Community Plugins
```

#### Method 2: Development Setup (For Contributors)
```bash
# Clone to your preferred development location
git clone https://github.com/shad/rdf-tools.git
cd rdf-tools

# Install dependencies
npm install

# Build the plugin
npm run build

# Create symlink to your vault (replace with your vault path)
ln -s "$(pwd)" "/path/to/your/vault/.obsidian/plugins/rdf-tools"

# Enable the plugin in Obsidian Settings → Community Plugins
```

#### Development Workflow
- **Rebuild after changes**: `npm run build`
- **Run tests**: `npm run test`
- **Format and lint**: `npm run check-all`
- **Development server**: `npm run dev` (watch mode)

#### Requirements for Building
- Node.js 18 or higher
- npm (comes with Node.js)

### Manual Installation (Plugin Store Release)
1. Download the latest release from [GitHub Releases](https://github.com/shad/rdf-tools/releases)
2. Extract to `vault/.obsidian/plugins/rdf-tools/`
3. Enable in Settings → Community Plugins

## Development

Want to contribute? See [docs/development-notes.md](docs/development-notes.md) for setup instructions and architecture details.

## Features & Performance

- ⚡ **Fast** - Lazy loading and smart caching keep things responsive
- 🔒 **Private** - Everything runs locally in your vault, no network requests
- 🧠 **Smart** - Only reprocesses what changed, with background updates
- ⏱️ **Protected** - Query timeouts and memory limits prevent issues

## Status: ✅ Complete & Ready

**Current Version**: 1.0.0 - Full functionality implemented and tested

### Possible Future Enhancements
- Visual graph explorer
- Query builder interface
- Additional export formats
- SHACL validation

## Documentation

- 📖 **[Available Graphs](docs/graphs.md)** - File graphs, meta graphs, and query patterns
- 🏗️ **[Ontology Reference](docs/ontology.md)** - Built-in vocabulary and schema
- 🏛️ **[Architecture](docs/architecture.md)** - Technical implementation details
- 🔧 **[Development](docs/development-notes.md)** - Contributing and setup guide

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/shad/rdf-tools/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/shad/rdf-tools/discussions)
- 📖 **Documentation**: See the `docs/` folder for technical details

## Contributing

We welcome contributions! Fork the repo, make your changes, and submit a pull request. See [docs/development-notes.md](docs/development-notes.md) for development setup.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**RDF Tools** - Turn your Obsidian vault into a semantic knowledge graph 🧠✨
