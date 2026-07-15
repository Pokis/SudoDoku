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
    id:'nakedPair', icon:'Ⅱ', level:'intermediate',
    board:'...7.........3.27..............6...1.6...153..........7.........3.2..649.5.......',
    solution:SOLUTION, choices:['1 & 7','1 & 8','2 & 8'], answer:'1 & 8', reward:150,
  },
  {
    id:'xWing', icon:'X', level:'advanced',
    board:'...7............7.2.......6....6.8........5....8..7...7......8........4...9......',
    solution:SOLUTION, choices:['3','7','9'], answer:'7', reward:150,
  },
];

const decode = (text) => [...text].map((value) => value === '.' ? 0 : Number(value));

export function getAcademyLesson(id) {
  const lesson = ACADEMY_LESSONS.find((item) => item.id === id) || ACADEMY_LESSONS[0];
  const board = decode(lesson.board);
  const solution = decode(lesson.solution);
  const hint = findTechniqueHint(board, solution);
  return { ...lesson, board, solution, hint, candidates:buildCandidateMap(board) };
}

export function isAcademyAnswer(id, answer) {
  const lesson = ACADEMY_LESSONS.find((item) => item.id === id);
  return Boolean(lesson && lesson.answer === answer);
}
