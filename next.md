DONE 
We should create a custom markdown graph parser that takes markdown and emits the correct prefixes and quads based on the file. This parser should follow the N3.Parser interface (or the bits that we use at least). Internally, it could still use the N3.Parser to parse individual blocks, but it would emulate the Parser interface and generate the graph from markdown (name: MarkdownGraphParser) This would encapsulate all the MarkdownParsing into a single simple place which would make it easier to test. It would take the file contents and scan them.


DONE?
Graphs should be calculated on the fly at query time, not premptively. The sparql query should always have the most recently parsed graphs possible. In the future, we will create a cache and deal with invalidation and laoading. It is critical that when turtle changes, sparql blocks in currently _all open files_ are recalculated. 

Create a new graph, <vault://metadata> which is a graph representation of the entire vault metadata, so files, connections between files, properties defined in files, statistics about files, that sort of thing. I would only be loaded if a sparql query has a FROM that references it.

Make the default base prefix editable in settings. Currently we use "vault://" as the base uri, but the user should be able to specify that we use somthing else (e.g. https://shadr.us/ )

Please update our CLAUDE.md, README.md and docs based on your learnings this session.
