export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "yellow" | "green";
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: Accent;
};
export const GAMES: Game[] = [
  {
    id: "arkanoid",
    title: "ARKANOID",
    short: "Rompe el muro, atrapa cápsulas y no pierdas la bola.",
    long: "Mueve la paleta y rebota la bola para derribar muros de bloques de colores a lo largo de 10 niveles. Atrapa cápsulas para ensanchar la paleta, multiplicar la bola, disparar láser o atravesar bloques, y gana una bola extra cada 2000 puntos.",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "yellow",
  },
  {
    id: "caida",
    title: "THETRIS",
    short: "Encaja las piezas antes de que el techo te aplaste.",
    long: "Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. Reserva una pieza con hold, encadena combos, T-spins y Tetris, y aguanta mientras la velocidad sube cada 10 líneas.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Crece sin morder tu propia cola.",
    long: "Una serpiente de luz recorre la grilla devorando frutas. Cada bocado suma 10 puntos y la alarga un segmento. Los bordes son portales: sales por un lado y apareces por el opuesto. Un movimiento en falso y se muerde a sí misma.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
  },
  {
    id: "gloton",
    title: "GLOTÓN",
    short: "Devora puntos y escapa de los fantasmas.",
    long: "Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
  },
  {
    id: "invasores",
    title: "INVASORES",
    short: "Defiende el planeta de filas alienígenas.",
    long: "Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
  },
  {
    id: "rocas",
    title: "ROCAS",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
  },
  {
    id: "asteroids",
    title: "ASTEROIDS",
    short: "Pulveriza asteroides en el vacío del espacio.",
    long: "Pilota tu nave con inercia en un campo de asteroides. Dispara para fragmentarlos en rocas cada vez más pequeñas y recoge el power-up de disparo triple para limpiar el sector. Sin OVNIs: solo tú y las rocas.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "cyan",
  },
  {
    id: "ranaria",
    title: "RANARIA",
    short: "Cruza la autopista de pixeles.",
    long: "Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.",
    cat: "ARCADE",
    cover: "cover-rana",
    color: "green",
  },
  {
    id: "duelo-pixel",
    title: "DUELO PIXEL",
    short: "Dos paletas. Una pelota. Reflejos máximos.",
    long: "El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.",
    cat: "VERSUS",
    cover: "cover-duelo",
    color: "cyan",
  },
];
export const CATS: ("TODOS" | Category)[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
