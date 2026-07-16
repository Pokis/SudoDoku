import { buildCandidateMap, findTechniqueHint } from './techniques.js';

const SOLUTION = '643752918195638274287419356372564891964821537518397462726943185831275649459186723';

export const ACADEMY_LESSONS = [
  {
    id:'nakedSingle', icon:'1', level:'foundation',
    board:`.${SOLUTION.slice(1)}`, solution:SOLUTION,
    choices:['4','6','9'], answer:'6', reward:150,
  },
  {
    id:'hiddenSingle', icon:'◇', level:'foundation',
    board:'..849.3.1.2716.4.9.....3...9.53.1..7...9.7...7..6.49.3...8.....8.6.1953.1.3.467..',
    solution:'568492371327168459491573826985321647634987215712654983279835164846719532153246798',
    choices:['2','7','9'], answer:'7', reward:150,
  },
  {
    id:'pointingPair', icon:'↗', level:'intermediate',
    board:'64....9.............7.1..........8............1...........431858...7.............',
    solution:SOLUTION, choices:['3','7','9'], answer:'7', reward:200,
  },
  {
    id:'boxLineReduction', icon:'⌟', level:'intermediate',
    board:'..37........6....4.8.4.........................8......7.......58..2......5.....2.',
    solution:SOLUTION, choices:['4','5','8'], answer:'5', reward:200,
  },
  {
    id:'nakedPair', icon:'Ⅱ', level:'intermediate',
    board:'...7.........3.27..............6...1.6...153..........7.........3.2..649.5.......',
    solution:SOLUTION, choices:['1 & 7','1 & 8','2 & 8'], answer:'1 & 8', reward:200,
  },
  {
    id:'hiddenPair', icon:'◫', level:'intermediate',
    board:'.......1....63............6.7..6.8......2...75...9.4.........8.....7..4..........',
    solution:SOLUTION, choices:['2 & 8','4 & 8','4 & 9'], answer:'4 & 8', reward:250,
  },
  {
    id:'nakedTriple', icon:'Ⅲ', level:'advanced',
    board:'...7.2...1.5.....42.741.3...7256..9..6....5.7...3..46.7.......5.31..56.94.9.8.7.3',
    solution:SOLUTION, choices:['2, 6 & 8','6, 8 & 9','3, 6 & 9'], answer:'6, 8 & 9', reward:300,
  },
  {
    id:'hiddenTriple', icon:'△', level:'advanced',
    board:'.4.75.9.8195....7..8.4...563.2.6.8...6.82.5....83..4627.6...1..831....49......7.3',
    solution:SOLUTION, choices:['1, 2 & 6','1, 3 & 6','2, 3 & 6'], answer:'1, 2 & 6', reward:300,
  },
  {
    id:'xWing', icon:'X', level:'advanced',
    board:'64...2..8...6......8......6.......9............8.9.........3.85...........9..6.2.',
    solution:SOLUTION, choices:['3','7','9'], answer:'9', reward:300,
  },
  {
    id:'xyWing', icon:'Y', level:'expert',
    board:'6.....9.8.9....27.2.........7.....91.6.8...375.8....6..2.9..1..8......4..59...7.3',
    solution:SOLUTION, choices:['1','3','4'], answer:'3', reward:400,
  },
  {
    id:'skyscraper', icon:'♜', level:'expert',
    board:'.4...2.18...638..4287.......7.......96.8.1....1.397..2.2.9..18....2..6.......67..',
    solution:SOLUTION, choices:['2','3','6'], answer:'3', reward:400,
  },
  {
    id:'swordfish', icon:'Ψ', level:'expert',
    board:'64.........5.3...4.....93..37....89..6.....37..8...4..7..9.3.8.......64...9.8....',
    solution:SOLUTION, choices:['5','7','9'], answer:'9', reward:400,
  },
];

const decode = (text) => [...text].map((value) => value === '.' ? 0 : Number(value));

export function getAcademyLesson(id) {
  const lesson = ACADEMY_LESSONS.find((item) => item.id === id) || ACADEMY_LESSONS[0];
  const board = decode(lesson.board);
  const solution = decode(lesson.solution);
  const hint = findTechniqueHint(board, solution, 'classic', lesson.id);
  return { ...lesson, board, solution, hint, candidates:buildCandidateMap(board) };
}

export function isAcademyAnswer(id, answer) {
  const lesson = ACADEMY_LESSONS.find((item) => item.id === id);
  return Boolean(lesson && lesson.answer === answer);
}
