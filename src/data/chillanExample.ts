import type { ContextGraph, WikiSearchResult } from '../types';

/** The real Wikipedia article behind the example (used when regenerating it at a different depth) */
export const chillanExampleArticle: WikiSearchResult = {
  title: '1939 Chillán earthquake',
  description: '',
  pageId: 0,
  url: 'https://en.wikipedia.org/wiki/1939_Chill%C3%A1n_earthquake',
};

/** Hardcoded example: 1939 Chillán earthquake causal context */
export const chillanExample: ContextGraph = {
  title: '1939 Chillán Earthquake',
  summary:
    'The 1939 Chillán earthquake killed approximately 28,000–30,000 people, making it one of the deadliest in Chilean history. ' +
    'The enormous death toll was not simply a seismic inevitability—it was the product of centuries of colonial transformation. ' +
    'Before the Spanish conquest, indigenous Mapuche and other peoples in the region built lightweight, single-story structures ' +
    'suited to a transient lifestyle and seismic terrain. The Spanish colonization of Chile beginning in the 1540s imposed ' +
    'European urban planning, heavy adobe and masonry construction, and permanent settlement patterns. Over nearly 400 years ' +
    'these building practices became culturally entrenched, concentrating populations in poorly reinforced structures. ' +
    'When the magnitude 8.3 earthquake struck on January 24, 1939, these heavy unreinforced buildings collapsed en masse, ' +
    'turning what would have caused far less harm to a transient indigenous settlement into one of history\'s deadliest seismic disasters.',
  nodes: [
    {
      id: 'mapuche',
      label: 'Pre-Colonial Mapuche Society',
      year: 'Pre-1540s',
      summary:
        'Indigenous Mapuche and neighboring peoples lived semi-transient lifestyles, building lightweight ruka (thatched wooden structures). ' +
        'These single-story, flexible buildings were well-suited to the seismically active region and caused minimal casualties during earthquakes.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Mapuche',
    },
    {
      id: 'conquest',
      label: 'Spanish Conquest of Chile',
      year: '1540s',
      summary:
        'Pedro de Valdivia led the Spanish conquest of Chile beginning in 1541. The colonizers imposed European settlement patterns, ' +
        'land ownership models, and urban planning. Indigenous populations were displaced, subjected to the encomienda system, and their ' +
        'building traditions were gradually replaced with European styles.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Spanish_conquest_of_Chile',
    },
    {
      id: 'adobe',
      label: 'Adoption of Adobe & Masonry Construction',
      year: '1600s–1800s',
      summary:
        'Over centuries, colonial and post-colonial Chilean cities adopted heavy adobe and unreinforced masonry as standard building materials. ' +
        'These European-derived techniques were culturally prestigious but fundamentally unsuited to a seismically active landscape. ' +
        'Multi-story adobe buildings became the norm in cities like Chillán.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Adobe',
    },
    {
      id: 'urbanization',
      label: 'Urban Concentration in Chillán',
      year: '1800s–1930s',
      summary:
        'Chillán grew as a regional urban center with densely packed neighborhoods of adobe buildings. ' +
        'Population density increased while building codes remained lax or nonexistent, compounding the vulnerability.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Chill%C3%A1n',
    },
    {
      id: 'earthquake',
      label: '1939 Chillán Earthquake',
      year: '1939',
      summary:
        'A magnitude 8.3 earthquake struck south-central Chile on January 24, 1939. The unreinforced adobe buildings in Chillán collapsed ' +
        'catastrophically, killing approximately 28,000–30,000 people. The city was almost entirely destroyed. This tragedy led to the ' +
        'creation of CORFO (Chile\'s Economic Development Agency) and catalyzed major reforms in building codes.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/1939_Chill%C3%A1n_earthquake',
    },
    {
      id: 'corfo',
      label: 'Creation of CORFO & Building Code Reforms',
      year: '1939–1940s',
      summary:
        'In the aftermath of the disaster, the Chilean government created CORFO to drive industrialization and reconstruction. ' +
        'New seismic building codes were introduced, eventually making Chile one of the best-prepared countries for earthquakes in the world.',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/CORFO',
    },
  ],
  edges: [
    {
      source: 'mapuche',
      target: 'conquest',
      label: 'Indigenous society disrupted by colonization',
    },
    {
      source: 'conquest',
      target: 'adobe',
      label: 'European building practices imposed',
    },
    {
      source: 'adobe',
      target: 'urbanization',
      label: 'Adobe construction becomes the norm',
    },
    {
      source: 'urbanization',
      target: 'earthquake',
      label: 'Dense adobe cities amplify seismic risk',
    },
    {
      source: 'earthquake',
      target: 'corfo',
      label: 'Disaster catalyzes institutional reform',
    },
    {
      source: 'mapuche',
      target: 'earthquake',
      label: 'Contrast: traditional building would have reduced deaths',
    },
  ],
};
