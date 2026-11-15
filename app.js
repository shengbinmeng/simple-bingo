(() => {
  const columns = ["B", "I", "N", "G", "O"];
  const cardsContainer = document.getElementById("cards-container");
  const cardTemplate = document.getElementById("card-template");
  const cardCountSelect = document.getElementById("card-count");
  const drawBall = document.getElementById("draw-ball");
  const drawButton = document.getElementById("draw-button");
  const callsList = document.getElementById("calls-list");
  const callsCount = document.getElementById("calls-count");
  const difficultySelect = document.getElementById("difficulty-select");
  const toast = document.getElementById("toast");
  let state;
  let toastShown = false;
  let toastTimer;
  let revealTimer;
  let pendingReveal = null;

  function makeCard() {
    const board = Array(25);
    columns.forEach((_, column) => {
      const start = column * 15 + 1;
      const numbers = Array.from({ length: 15 }, (_, i) => start + i);
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      numbers.slice(0, 5).forEach((number, row) => {
        board[row * 5 + column] = number;
      });
    });
    board[12] = null;
    return board;
  }

  function newGameState(count = Number(cardCountSelect?.value) || 1) {
    return {
      cards: Array.from({ length: count }, () => ({ board: makeCard(), marked: ["free"] })),
      calls: [],
      expressions: {},
      difficulty: 1
    };
  }

  function saveState(nextState) {
    state = nextState;
    render();
  }

  function numberLabel(number) {
    return `${columns[Math.floor((number - 1) / 15)]} ${number}`;
  }

  function makeExpression(number, difficulty) {
    if (difficulty === 3) {
      const start = Math.floor(Math.random() * 10);
      const clues = [];
      for (let attempt = 0; attempt < 10; attempt++) {
        const offset = (start + attempt) % 10 + 1;
        for (const [product, operation] of [[number + offset, "-"], [number - offset, "+"]]) {
          if (product < 4) continue;
          const factors = [];
          for (let factor = 2; factor <= Math.sqrt(product); factor++) {
            if (product % factor === 0) factors.push(factor);
          }
          if (factors.length) {
            const first = factors[Math.floor(Math.random() * factors.length)];
            clues.push(`${first} x ${product / first} ${operation} ${offset}`);
          }
        }
      }
      if (clues.length) return clues[Math.floor(Math.random() * clues.length)];
    }
    const operations = difficulty === 4 ? ["+", "-", "x", "/"] : ["+", "-", "x"];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    if (operation === "+") {
      const first = Math.floor(Math.random() * number);
      return `${first} + ${number - first}`;
    }
    if (operation === "-") {
      const second = Math.floor(Math.random() * 12) + 1;
      return `${number + second} - ${second}`;
    }
    if (operation === "/") {
      const divisor = Math.floor(Math.random() * 9) + 2;
      return `${number * divisor} / ${divisor}`;
    }
    const factors = [];
    for (let factor = 1; factor <= Math.sqrt(number); factor++) {
      if (number % factor === 0) factors.push(factor);
    }
    const first = factors[Math.floor(Math.random() * factors.length)];
    return `${first} x ${number / first}`;
  }

  function didWin(card) {
    const marked = new Set(card.marked);
    const filled = (row, column) => {
      const value = card.board[row * 5 + column];
      return value === null || marked.has(String(value));
    };
    for (let i = 0; i < 5; i++) {
      if (Array.from({ length: 5 }, (_, j) => filled(i, j)).every(Boolean)) return true;
      if (Array.from({ length: 5 }, (_, j) => filled(j, i)).every(Boolean)) return true;
    }
    return Array.from({ length: 5 }, (_, i) => filled(i, i)).every(Boolean)
      || Array.from({ length: 5 }, (_, i) => filled(i, 4 - i)).every(Boolean);
  }

  function renderCard() {
    if (!cardsContainer || !cardTemplate) return;
    const called = new Set(state.calls);
    cardsContainer.dataset.count = String(state.cards.length);
    cardsContainer.replaceChildren();
    let anyWon = false;
    state.cards.forEach((card, cardIndex) => {
      const element = cardTemplate.content.firstElementChild.cloneNode(true);
      const won = didWin(card);
      const marked = new Set(card.marked);
      const heading = element.querySelector("h1");
      const status = element.querySelector(".game-status");
      const grid = element.querySelector(".bingo-grid");
      element.setAttribute("aria-label", `Bingo card ${cardIndex + 1}`);
      heading.textContent = state.cards.length === 1 ? "Your card" : `Card ${cardIndex + 1}`;
      status.textContent = won ? "Bingo!" : "Your turn";
      status.classList.toggle("won", won);
      card.board.forEach((number, index) => {
        const row = Math.floor(index / 5);
        const column = index % 5;
        const isFree = number === null;
        const value = isFree ? "free" : String(number);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `cell${isFree ? " free" : ""}${marked.has(value) ? " marked" : ""}${!isFree && called.has(number) ? " called" : ""}`;
        button.dataset.value = value;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", isFree ? "Free space, marked" : `${columns[column]} ${number}`);
        button.setAttribute("aria-pressed", String(marked.has(value)));
        button.disabled = won;
        button.textContent = isFree ? "FREE" : number;
        button.addEventListener("click", () => toggleMark(cardIndex, value));
        grid.append(button);
      });
      anyWon ||= won;
      cardsContainer.append(element);
    });
    if (anyWon && !toastShown) {
      toastShown = true;
      if (toast) toast.classList.add("show");
      clearTimeout(toastTimer);
      if (toast) toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
    } else if (!anyWon) {
      toastShown = false;
      if (toast) toast.classList.remove("show");
    }
  }

  function renderCaller() {
    if (!drawButton) return;
    clearTimeout(revealTimer);
    if (difficultySelect) difficultySelect.value = String(state.difficulty);
    const latest = state.calls[0];
    drawBall.replaceChildren();
    drawBall.classList.toggle("harder", state.difficulty > 1);
    if (latest) {
      const value = document.createElement("span");
      value.className = "ball-value";
      const letter = document.createElement("span");
      letter.className = "ball-letter";
      letter.textContent = columns[Math.floor((latest - 1) / 15)];
      const number = document.createElement("span");
      number.className = "ball-number";
      number.textContent = state.difficulty > 1 ? state.expressions[latest] : String(latest);
      number.addEventListener("animationend", () => revealCalls(latest), { once: true });
      value.append(letter, number);
      drawBall.append(value);
      drawBall.classList.remove("revealed");
      drawBall.classList.add("revealing");
      drawBall.setAttribute("aria-label", `Click to finish revealing ${numberLabel(latest)}${state.difficulty > 1 ? ` as ${state.expressions[latest]}` : ""}`);
      pendingReveal = latest;
      drawButton.disabled = true;
      drawButton.textContent = "Revealing number...";
      revealTimer = setTimeout(() => revealCalls(latest), 9300);
    } else {
      drawBall.textContent = "B–O";
      drawBall.setAttribute("aria-label", "Number display. Draw a number to start.");
      drawBall.classList.remove("revealed");
      drawBall.classList.remove("revealing");
      pendingReveal = null;
      drawButton.disabled = false;
      renderCalls();
    }
    drawBall.classList.toggle("empty", !latest);
    if (!pendingReveal && state.calls.length === 75) {
      drawButton.disabled = true;
      drawButton.textContent = "All numbers called";
    } else if (!pendingReveal) {
      drawButton.textContent = "Draw a number";
    }
  }

  function revealCalls(latest) {
    if (state.calls[0] !== latest || pendingReveal !== latest) return;
    clearTimeout(revealTimer);
    pendingReveal = null;
    drawBall.classList.add("revealed");
    drawBall.classList.remove("revealing");
    drawBall.setAttribute("aria-label", `Last number called ${numberLabel(latest)}${state.difficulty > 1 ? `, shown as ${state.expressions[latest]}` : ""}`);
    callsCount.textContent = `${state.calls.length} / 75`;
    renderCalls();
    drawButton.disabled = state.calls.length === 75;
    drawButton.textContent = state.calls.length === 75 ? "All numbers called" : "Draw a number";
  }

  function renderCalls() {
    callsList.replaceChildren();
    if (!state.calls.length) {
      const empty = document.createElement("span");
      empty.className = "empty-calls";
      empty.textContent = "Numbers will show up here";
      callsList.append(empty);
      return;
    }
    state.calls.forEach((number, index) => {
      const chip = document.createElement("span");
      chip.className = `call-chip${index === 0 ? " latest" : ""}`;
      chip.textContent = numberLabel(number);
      callsList.append(chip);
    });
  }

  function render() {
    renderCard();
    renderCaller();
  }

  function toggleMark(cardIndex, value) {
    const card = state.cards[cardIndex];
    if (didWin(card)) return;
    const marked = new Set(card.marked);
    if (marked.has(value)) {
      if (value === "free") return;
      marked.delete(value);
    } else {
      marked.add(value);
    }
    const cards = state.cards.map((current, index) => (
      index === cardIndex ? { ...current, marked: [...marked] } : current
    ));
    saveState({ ...state, cards });
  }

  function drawNumber() {
    if (pendingReveal !== null) {
      revealCalls(pendingReveal);
      return;
    }
    if (state.calls.length === 75) return;
    const called = new Set(state.calls);
    const remaining = Array.from({ length: 75 }, (_, i) => i + 1).filter(number => !called.has(number));
    const number = remaining[Math.floor(Math.random() * remaining.length)];
    saveState({
      ...state,
      calls: [number, ...state.calls],
      expressions: { ...state.expressions, [number]: makeExpression(number, state.difficulty) }
    });
  }

  function startNewGame() {
    toastShown = false;
    clearTimeout(toastTimer);
    pendingReveal = null;
    if (toast) toast.classList.remove("show");
    saveState(newGameState());
  }

  state = newGameState();
  render();

  if (drawButton) drawButton.addEventListener("click", drawNumber);
  if (difficultySelect) difficultySelect.addEventListener("change", () => {
    state.difficulty = Number(difficultySelect.value);
    const latest = state.calls[0];
    if (latest) {
      state.expressions = {
        ...state.expressions,
        [latest]: makeExpression(latest, state.difficulty)
      };
    }
    renderCaller();
  });
  if (drawBall) drawBall.addEventListener("click", () => {
    if (pendingReveal !== null) revealCalls(pendingReveal);
  });
  const newGameButton = document.getElementById("new-game");
  if (newGameButton) newGameButton.addEventListener("click", startNewGame);
  if (cardCountSelect) cardCountSelect.addEventListener("change", startNewGame);
})();
