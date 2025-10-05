# RDF Tools - Obsidian Community Plugin

## Project Overview

- **Target**: Obsidian Community Plugin for working with RDF data and SPARQL queries
- **Purpose**: Enable users to work with RDF data directly in their vault using Turtle code blocks and SPARQL queries with live-updating results
- **Entry point**: `src/main.ts` compiled to `main.js` and loaded by Obsidian
- **Required release artifacts**: `main.js`, `manifest.json`, and optional `styles.css`

## Environment & Tooling

- **Node.js**: Use current LTS (Node 18+ recommended)
- **Package manager**: npm (required - `package.json` defines npm scripts and dependencies)
- **Bundler**: esbuild (configured in `esbuild.config.mjs` for fast development and production builds)
- **Types**: `obsidian` type definitions + custom RDF types
- **Code Quality**: ESLint + Prettier integration with comprehensive check scripts

### Key Dependencies

- **N3.js** - RDF parsing and triple store functionality
- **Comunica** - SPARQL query execution engine
- **TypeScript** - Primary development language with strict typing
- **ESLint** - Code linting and quality enforcement
- **Prettier** - Code formatting consistency

### Installation & Setup

```bash
npm install
```

### Development Commands

```bash
npm run dev          # Start development server with watch mode
npm run build        # Production build
npm run check-all    # Format, fix lint issues, and type check (all-in-one)
npm run lint         # ESLint checking only
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Format all code with Prettier
npm run format:check # Check formatting without fixing
npm run typecheck    # TypeScript type checking only
```

## Acceptance Criteria

- User can edit a document in obsidian

- User can add `turtle` code blocks (in the normal way)

- When user moves cursor outside of turtle block, code should be parsed and errors shown below the block

- User can add `sparql` code blocks (in the normal way)

- When the cursor exists a `sparql` block
  - the query should be parsed, and errors noted below the query (or inline)
  - the query should be executed, and results shown below the query

- For SPARQL queries
  - If FROM clause is not specfied, the query is run against the current file/graph only.
  - If FROM clause is specified, then the query is run against the specified graph(s) only (possibly not the current file)

- When a file with SPARQL a query is open, that query is executed automatically as changes occur in the same document, or other documents

- While  the query is executing, "loading" message should display. 
- Once the query is complete, results should be shown below:
  - SELECT queries should be followed by a table of the results of the query
  - CONSTRUCT queries should be followed by syntax highlighted turtle
  - DESCRIBE queries should follow CONSTRUCT semantics
  - ASK queries should produce true/false (simple monospace font)

- As turtle is updated in an open file, the SPARQL in any open file should be updated immediately. The user should not need to "Run" the query. 

- SPARQL queries can specify other files/directory graphs in their FROM clause.
  - [no from] - query the current file graph ONLY. If a FROM clause exists, do not include the current file by default.
  - FROM <vault://somefile.md> or FROM <vault://somedirectory/somefile.md> - query only the referenced file, and nothing else.
  - FROM <vault://somedirectory/> - query all files contained in this directory, recursively
  - FROM <vault://> - query across data in all files in the system
  - FROM <vault://someturtle.ttl> - A .ttl file has been added directly to the vault, please use it to query.

- When defining turtle in a file, the base for urls should be <vault://somedirectory/somefile.md/>
  - in `somefile.md` if I have `<test>` then the IRI would expand to <vault://somedirectory/somefile.md/test>

- SPARQL queries should always have a core set of default prefixes defined (rdf, rdfs, owl, foaf, etc)

- SPARQL query code block should check query for correctness using sparqljs when the user moves out of the block. If there are errors, they should be presented below the query code block.

## Project Structure

The project follows a layered architecture with clean separation of concerns:

```
src/
├── main.ts          # Plugin entry point, lifecycle management
├── services/        # Core RDF processing services
│   └── *Service.ts  # Services should end in "Service"
├── models/          # Data models and interfaces
│   └── *.ts         # Models contain data containers, and manipulation functions
├── ui/              # Obsidian UI components
├── utils/           # Helper utilities
├── tests/           # Tests infrastructure
└── types/           # TypeScript type definitions
```

## File & Folder Conventions

- **Source lives in `src/`**: Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands)
- **Service Layer Pattern**: Each service has a specific responsibility and can be tested independently
- **Dependency Injection**: Services accept dependencies through constructors for easy mocking and testing
- **Clean Imports**: Use barrel exports from directories where appropriate

## Core Features Implementation

### RDF Data Processing
- **Turtle Block Detection**: Extract and parse `turtle` code blocks from markdown files
- **Graph Management**: Each file becomes a named graph with URI scheme `vault://path/filename.md`
- **URI Resolution**: Base URIs set as `@base <vault://path/filename.md/>` for local entity resolution while parsing

### SPARQL Query Execution  
- **Query Processing**: Execute SPARQL queries using Comunica engine
- **Graph Selection**: Support `FROM` and `FROM NAMED` clauses for targeted querying
- **Live Updates**: Query results update automatically when underlying turtle data changes

### Performance & Scalability
- **Lazy Loading**: Load graphs on-demand to manage memory usage
- **Incremental Updates**: Only reprocess changed turtle blocks
- **Dependency Tracking**: Smart invalidation of affected queries

## Development Workflow

### Code Quality Standards
- **TypeScript Strict Mode**: Enforce strict typing throughout codebase, no `any` types
- **Unused Code Detection**: Knip detects unused exports, class members, and dependencies
- **ESLint Rules**: Comprehensive linting with TypeScript-specific rules
- **Prettier Formatting**: Consistent code formatting (single quotes, 80-char width, 2-space tabs)
- **All-in-One Quality Check**: Use `npm run check-all` to format, lint, detect unused code, type check, and test in one command

### Testing Strategy
- **Unit Tests**: Test individual services and models with mocked dependencies
- **Integration Tests**: Test service interactions with real RDF libraries
- **Plugin Tests**: Test Obsidian integration with mocked APIs
- **Mock Strategy**: Mock N3.js and Comunica at service boundaries, test business logic

### Error Handling
- **Graceful Degradation**: Continue processing valid blocks when some fail
- **User Feedback**: Meaningful error messages and recovery guidance
- **Partial Failures**: Handle file-level and block-level errors independently
- **Debugging Support**: Comprehensive logging and diagnostic capabilities

## Manifest Configuration

Key settings in `manifest.json`:
- `id`: "rdf-tools" (stable, never change after release)
- `isDesktopOnly`: true (RDF processing complexity requires desktop environment) TODO: is this really true?
- `minAppVersion`: Set appropriately for required Obsidian API features
- `description`: Clear description of RDF and SPARQL capabilities

## Security & Privacy

- **Local Processing**: All RDF operations happen locally within the vault
- **No External Calls**: No network requests unless explicitly configured by user
- **Vault Isolation**: Restrict access to current vault only
- **Resource Limits**: Query timeouts and memory usage controls
- **Input Validation**: Comprehensive validation of SPARQL queries and turtle syntax

## Performance Considerations

- **Query Optimization**: Query plan caching and selective graph loading
- **Background Processing**: Expensive operations don't block UI
- **Incremental Loading**: Process changes incrementally rather than full reloads

## Release Preparation

- **Build Verification**: Ensure `npm run build` produces valid artifacts
- **Quality Assurance**: Run `npm run check-all` to ensure all code is formatted, linted, and type-safe
- **Version Management**: Update `manifest.json` version before release
- **Release Assets**: Include `main.js`, `manifest.json`, and `styles.css` (if present)

## Agent Guidelines

### Development Best Practices
- **Follow Architecture**: Respect the layered service architecture
- **Test Coverage**: Write tests for new functionality using established patterns  
- **Error Handling**: Implement comprehensive error recovery
- **Performance**: Consider memory usage and query performance impacts
- **Documentation**: Update relevant documentation for API changes

### Code Quality Requirements
- **Use Check-All Command**: Always run `npm run check-all` to automatically format code, fix lint issues, and verify types
- **Single Command Workflow**: `check-all` is the primary quality assurance tool - no need for separate format/lint steps
- **Type Safety**: Maintain strict TypeScript compliance (verified as part of check-all)

### Testing Requirements
- **Mock External Dependencies**: Use dependency injection for testability
- **Test Business Logic**: Focus tests on plugin logic, not library functionality
- **Integration Testing**: Test service interactions with controlled inputs
- **Error Scenarios**: Test error handling and recovery paths

## TypeScript Guidelines

**NEVER use `any` as a type** - Always use proper TypeScript types:
- Use specific interfaces and types from libraries (e.g., `Term`, `Quad` from `n3`)
- Create union types or generics instead of `any`
- Use type assertions with proper types: `error as TurtleParseError` not `error as any`
- Import proper types from dependencies rather than falling back to `any`

## Named Graph Requirements

**CRITICAL**: When SPARQL queries use `FROM <graph-uri>` or `FROM NAMED <graph-uri>`, the RDF data MUST be stored as quads with that specific graph context in the N3.js Store.

### Correct Implementation:
```typescript
// SPARQL: FROM <meta://>
// RDF: Must use quads with meta:// graph context
store.addQuad(quad(subject, predicate, object, namedNode('meta://')));
```

### Incorrect Implementation:
```typescript
// SPARQL: FROM <meta://>
// RDF: Triples in default graph (will return 0 results and may cause Comunica stream hanging)
store.addQuad(quad(subject, predicate, object)); // Missing graph context
```

### Why This Matters:
- Comunica treats N3.js Store quads with graph context as named graphs
- SPARQL `FROM <uri>` queries only match quads with that specific graph context
- Missing graph context results in empty results and potential stream hanging
- Mixed graph queries (`FROM <graph1> FROM <graph2>`) require each graph to have proper context

## Obsidian Community Plugin Compliance Rules

**CRITICAL**: These rules MUST be followed to maintain Obsidian marketplace compliance. Violations will prevent plugin approval.

### 1. File/Folder Type Safety
**ALWAYS use TypeScript type guards for safe file/folder validation**

❌ **FORBIDDEN:**
```typescript
const file = app.vault.getAbstractFileByPath(path) as TFile;
// OR complex duck typing checks
const abstractFile = app.vault.getAbstractFileByPath(path);
if (!abstractFile || !('extension' in abstractFile) || !('stat' in abstractFile) || 'children' in abstractFile) {
  return;
}
```

✅ **REQUIRED - Use Type Guards:**
```typescript
import { safeTFileFromPath, isTFile, isTFolder } from '../models/TypeGuards';

// Simple file retrieval
const file = safeTFileFromPath(app.vault, path);
if (!file) {
  // Handle error - not found or not a file
  return;
}

// Type checking existing objects
if (isTFile(abstractFile)) {
  const file = abstractFile; // TypeScript knows this is TFile
  // ... work with file
}

if (isTFolder(abstractFile)) {
  const folder = abstractFile; // TypeScript knows this is TFolder
  // ... work with folder
}
```

**Type Guard Functions** (defined in `src/models/TypeGuards.ts`):
- `isTFile(file)` - Checks if object is a TFile
- `isTFolder(file)` - Checks if object is a TFolder
- `safeTFileFromPath(vault, path)` - Safely gets TFile or returns null
- `safeTFolderFromPath(vault, path)` - Safely gets TFolder or returns null
- `validateFileType(file, 'file'|'folder')` - Validation with error messages

### 2. DOM Security - NO innerHTML
**NEVER use innerHTML, outerHTML, or insertAdjacentHTML**

❌ **FORBIDDEN:**
```typescript
element.innerHTML = content;
element.outerHTML = content;
element.insertAdjacentHTML('beforeend', content);
```

✅ **REQUIRED:**
```typescript
element.textContent = content;  // For text content
element.createEl('div');        // For element creation
element.appendChild(newElement); // For DOM manipulation
```

**Obsidian Helper Functions**: Use `createEl()`, `createDiv()`, `createSpan()` methods

### 3. Styling - NO JavaScript Style Assignment
**NEVER assign styles via JavaScript**

❌ **FORBIDDEN:**
```typescript
element.style.color = 'red';
element.style.padding = '10px';
element.setAttribute('style', 'color: red');
```

✅ **REQUIRED:**
```typescript
element.classList.add('my-style-class');
element.classList.remove('unwanted-class');
// Define styles in styles.css file
```

**CSS Classes**: All styling must be in `styles.css` using CSS classes and CSS variables

### 4. Console Logging Control
**NEVER use direct console.log in production code**

❌ **FORBIDDEN:**
```typescript
console.log('Debug info');
console.warn('Warning');
console.error('Error');
```

✅ **REQUIRED:**
```typescript
this.logger.debug('Debug info');    // Controlled by settings
this.logger.warn('Warning');        // Always logged
this.logger.error('Error');         // Always logged
```

**Logger Usage**: Use centralized Logger class with configurable debug levels

### 5. Type Safety - NO 'as any'
**NEVER use 'as any' casting in production code**

❌ **FORBIDDEN:**
```typescript
const result = someFunction() as any;
const data = response as any;
```

✅ **REQUIRED:**
```typescript
const result: SpecificType = someFunction();
const data = response as ExpectedInterface;
// Use proper interfaces and type guards
```

**Exception**: 'as any' is acceptable ONLY in test files for mocking complex objects

### 6. Build Configuration
**Production builds must be readable (not minified)**

✅ **REQUIRED in esbuild.config.mjs:**
```javascript
minify: false,  // REQUIRED for Obsidian compliance
```

### 7. Error Handling Patterns
**Always implement graceful error handling**

✅ **REQUIRED:**
```typescript
try {
  // Risky operation
} catch (error) {
  this.logger.error('Operation failed:', error);
  // Provide user feedback
  new Notice('Operation failed: ' + error.message);
  // Continue execution gracefully
}
```

### 8. Compliance Verification
**Before any release or major changes:**

```bash
npm run check-all  # Must pass without errors
npm run build      # Must generate readable main.js
```

**Automated Checks**:
- No innerHTML/outerHTML usage
- No direct style assignments
- No unsafe casting without validation
- No 'as any' in production code
- No direct console usage in production

### 9. Test File Exceptions
**Test files (.test.ts, .spec.ts) may use:**
- 'as any' for mocking complex Obsidian API objects
- innerHTML for DOM testing scenarios
- Direct console.log for test debugging (should be commented out)

### 10. Release Artifacts Requirements
**Required files for Obsidian marketplace:**
- `main.js` - Must be readable (not minified)
- `manifest.json` - Must follow Obsidian schema exactly
- `styles.css` - Optional but recommended for custom styling

**ENFORCEMENT**: These rules are enforced by:
1. ESLint rules (where possible)
2. Manual code review before release
3. Obsidian's automated scanning system
4. Community review process

Violating these rules will result in plugin rejection by Obsidian's review process.

This project implements a sophisticated RDF processing system within Obsidian while maintaining clean architecture, comprehensive testing, and excellent developer experience.
