# RDF Tools for Obsidian

An Obsidian plugin that enables working with RDF data and SPARQL queries directly within your vault. Transform your notes into a queryable knowledge graph using Turtle code blocks and live-updating SPARQL results.

## Features

- 🐢 **Turtle Code Blocks** - Write RDF data directly in markdown using `turtle` code blocks
- 🔍 **SPARQL Queries** - Execute SPARQL queries against your RDF data with `sparql` code blocks
- ⚡ **Live Updates** - Query results automatically update when underlying turtle data changes
- 🗂️ **Named Graphs** - Each file becomes a named graph with URI scheme `vault://path/filename.md`
- 🏷️ **Prefix Management** - Global and file-local prefix support with intelligent merging
- 📊 **Result Formatting** - Table, list, count, and custom formatting options for query results

## Example Usage

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

## Architecture

RDF Tools follows a layered architecture designed for performance, testability, and extensibility:

### Core Services
- **GraphService** - Graph storage and management using N3.js
- **QueryService** - SPARQL execution with Comunica engine
- **ParsingService** - Turtle syntax parsing and validation
- **PrefixService** - Namespace and prefix management
- **DependencyService** - Change tracking for live updates
- **CacheService** - Multi-level caching for performance

### URI Resolution
- Base URI: `@base <vault://path/filename.md/>` for each file
- Named graphs: `<vault://path/filename.md>` for graph identification
- Global queries: `<vault://>` queries across all files in vault
- Directory queries: `<vault://folder/>` queries all files in folder

## Development

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm (for package management)

### Setup
```bash
git clone <repository-url>
cd rdf-tools
npm install
```

### Development Commands

```bash
# Development
npm run dev          # Start development server with watch mode
npm run build        # Production build

# Code Quality  
npm run check-all    # Run all quality checks (recommended before commits)
npm run lint         # ESLint checking
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Format code with Prettier
npm run format:check # Check formatting without fixing
npm run typecheck    # TypeScript type checking
```

### Project Structure
```
src/
├── main.ts                 # Plugin entry point
├── services/              # Core RDF processing services
├── models/               # Data models and interfaces  
├── ui/                   # Obsidian UI components
├── utils/                # Helper utilities
├── types/                # TypeScript definitions
└── __tests__/            # Test files
```

### Testing Strategy
- **Unit Tests** - Individual services with mocked dependencies
- **Integration Tests** - Service interactions with real RDF libraries
- **Plugin Tests** - Obsidian integration with mocked APIs

## Installation

### Manual Installation (Development)
1. Clone this repository to your vault's plugins folder:
   ```bash
   cd /path/to/vault/.obsidian/plugins/
   git clone <repository-url> rdf-tools
   cd rdf-tools
   npm install && npm run build
   ```

2. Enable the plugin in Obsidian Settings → Community Plugins

### From Community Plugin Store
*Coming soon - plugin will be submitted to community store after beta testing*

## Technical Details

### Dependencies
- **N3.js** - RDF parsing, serialization, and triple store
- **Comunica** - SPARQL query execution engine  
- **TypeScript** - Type-safe development
- **esbuild** - Fast bundling for development and production

### Performance Features
- **Lazy Loading** - Graphs loaded on-demand
- **Incremental Updates** - Only reprocess changed content
- **Smart Caching** - Multi-level cache with intelligent invalidation
- **Background Processing** - Heavy operations don't block UI

### Security & Privacy
- **Local Processing** - All RDF operations happen locally within your vault
- **No Network Requests** - Completely offline operation by default
- **Vault Isolation** - Plugin only accesses files within the current vault
- **Resource Limits** - Query timeouts and memory usage controls

## Roadmap

### Phase 1: Foundation ✅ 
- [x] Project setup and architecture
- [x] Build system and development workflow
- [ ] Core type definitions and models

### Phase 2: RDF Processing (In Progress)
- [ ] Turtle block detection and parsing
- [ ] N3.js integration for graph storage
- [ ] Basic URI resolution and base URI handling

### Phase 3: SPARQL Engine
- [ ] Comunica integration
- [ ] Query parsing and execution
- [ ] Basic result formatting

### Phase 4: File System Integration
- [ ] File monitoring and change detection
- [ ] Incremental graph updates
- [ ] Dependency tracking

### Phase 5: UI Integration
- [ ] Markdown post-processing for results
- [ ] Settings panel and configuration
- [ ] Error handling and user feedback

### Phase 6: Advanced Features
- [ ] Live query updates
- [ ] Performance optimization
- [ ] Advanced result formatting
- [ ] Query debugging tools

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the established patterns
4. Run quality checks: `npm run check-all`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Standards
- Follow TypeScript strict mode
- Use ESLint and Prettier (configured automatically)
- Write tests for new functionality
- Follow the established service layer architecture
- Update documentation for API changes

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📖 **Documentation**: See `docs/` folder for detailed architecture and implementation notes
- 🐛 **Issues**: Report bugs and feature requests via GitHub Issues
- 💬 **Discussions**: Join discussions about RDF workflows in Obsidian

---

**Status**: 🚧 Early development - not yet ready for production use

This plugin is being developed incrementally with a focus on solid foundations, comprehensive testing, and excellent user experience.