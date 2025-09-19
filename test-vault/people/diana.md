# Diana Wilson - Product Manager

Diana leads product strategy and roadmap planning.

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .

<diana> a foaf:Person ;
    foaf:name "Diana Wilson" ;
    foaf:mbox <mailto:diana@example.org> ;
    foaf:knows <bob>, <charlie> ;
    ex:title "Product Manager" ;
    ex:department "Product" ;
    ex:worksOn <project-mobile>, <project-ai> ;
    ex:skill "Product Strategy", "Roadmap Planning", "User Research", "Analytics" .
```