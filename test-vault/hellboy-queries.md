
```sparql
PREFIX : <vault://hellboy-universe.md/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rel: <http://purl.org/vocab/relationship/>

SELECT ?g ?parent ?child ?parentSpecies ?childSpecies 
FROM <vault://hellboy-universe.md>
WHERE {
  ?parentEntity rel:parentOf ?childEntity ;
                foaf:name ?parent ;
                :species ?parentSpecies .
  ?childEntity foaf:name ?child ;
               :species ?childSpecies .
}
```

```sparql
# @view table
select *
FROM <vault://hellboy-universe.md>
WHERE {
  ?s ?p ?o .
}
LIMIT 5
```

```sparql
SELECT (COUNT(*) as ?count)
FROM <vault://>
where { ?s ?p ?o . }
```

| test | foo  |     |
| ---- | ---- | --- |
| bar  | baz  |     |
| asdf | asdf |     |
