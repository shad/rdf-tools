# Hellboy Universe

The Hellboy universe, created by Mike Mignola, is a dark fantasy comic series featuring supernatural creatures, occult mysteries, and paranormal investigations. The Bureau for Paranormal Research and Defense (B.P.R.D.) serves as the primary organization fighting against supernatural threats to humanity.

## Characters and Relationships

```turtle
@prefix : <vault://hellboy-universe.md/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix org: <http://www.w3.org/ns/org#> .
@prefix rel: <http://purl.org/vocab/relationship/> .

# Organizations 
:BPRD a org:Organization ;
    foaf:name "Bureau for Paranormal Research and Defense" ;
    org:purpose "Defending humanity against supernatural threats" .

:NaziOccultProgram a org:Organization ;
    foaf:name "Nazi Occult Program" ;
    org:purpose "Summoning supernatural entities for warfare" .

# Characters
:Hellboy a foaf:Person ;
    foaf:name "Hellboy" ;
    foaf:nick "Anung Un Rama" ;
    :species "Demon" ;
    :origin "Hell" ;
    :rightHandMaterial "Stone" ;
    org:memberOf :BPRD ;
    rel:childOf :Azzael ;
    :summonedBy :NaziOccultProgram .

:LizSherman a foaf:Person ;
    foaf:name "Elizabeth Sherman" ;
    foaf:nick "Liz" ;
    :species "Human" ;
    :ability "Pyrokinesis" ;
    org:memberOf :BPRD ;
    rel:friendOf :Hellboy .

:AbeSupien a foaf:Person ;
    foaf:name "Abraham Sapien" ;
    foaf:nick "Abe" ;
    :species "Amphibian humanoid" ;
    :ability "Psychometry" ;
    org:memberOf :BPRD ;
    rel:friendOf :Hellboy .

:TrevorBruttenholm a foaf:Person ;
    foaf:name "Trevor Bruttenholm" ;
    foaf:nick "Professor Broom" ;
    :species "Human" ;
    org:memberOf :BPRD ;
    :role "Director" ;
    rel:parentOf :Hellboy .

:RasputinGrigori a foaf:Person ;
    foaf:name "Grigori Rasputin" ;
    :species "Human" ;
    :status "Undead" ;
    :allegiance "Ogdru Jahad" ;
    org:memberOf :NaziOccultProgram ;
    :enemy :Hellboy .

:Azzael a foaf:Person ;
    foaf:name "Azzael" ;
    :species "Demon" ;
    :rank "Duke of Hell" ;
    rel:parentOf :Hellboy .

# Relationships
:Hellboy rel:colleagueOf :LizSherman, :AbeSupien .
:LizSherman rel:colleagueOf :AbeSupien .
```

## SPARQL Queries

### Find all B.P.R.D. members and their abilities

```sparql
PREFIX : <vault://hellboy-universe.md/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX org: <http://www.w3.org/ns/org#>

SELECT ?name ?ability WHERE {
  ?person org:memberOf :BPRD ;
          foaf:name ?name .
  OPTIONAL { ?person :ability ?ability }
}
```

### Discover family relationships in the supernatural world

```sparql
PREFIX : <vault://hellboy-universe.md/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rel: <http://purl.org/vocab/relationship/>

SELECT ?parent ?child ?parentSpecies ?childSpecies WHERE {
  ?parentEntity rel:parentOf ?childEntity ;
                foaf:name ?parent ;
                :species ?parentSpecies .
  ?childEntity foaf:name ?child ;
               :species ?childSpecies .
}
```

```sparql
# @view table
PREFIX : <vault://hellboy-universe.md/>
select *
FROM :
WHERE {
  ?s ?p ?o .
}
LIMIT 5
```

```sparql
# @view table
PREFIX : <vault://hellboy-universe.md/>
select *
WHERE {
  ?s ?p ?o .
}
LIMIT 5
```

