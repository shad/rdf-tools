# ACME Corporation

Technology company specializing in semantic web and AI solutions.

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .
@prefix org: <http://www.w3.org/ns/org#> .

<acme-corp> a org:Organization ;
    foaf:name "ACME Corporation" ;
    org:purpose "Technology solutions in semantic web and AI" ;
    ex:founded "2020" ;
    ex:headquarters "San Francisco, CA" ;
    ex:industry "Technology" ;
    ex:size "Medium" ;
    ex:website "https://acme-corp.example.org" .
```