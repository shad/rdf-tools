# Semantic Web Meetup 2024

Monthly meetup for semantic web enthusiasts and practitioners.

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .
@prefix event: <http://purl.org/NET/c4dm/event.owl#> .

<semantic-web-meetup-2024> a event:Event ;
    foaf:name "Semantic Web Meetup 2024" ;
    event:place "San Francisco, CA" ;
    ex:date "2024-04-15" ;
    ex:time "18:00" ;
    ex:organizer <alice> ;
    ex:attendee <bob>, <charlie>, <diana> ;
    ex:topic "RDF Tools", "Knowledge Graphs", "SPARQL Optimization" .
```