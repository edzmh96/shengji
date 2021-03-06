import {AppState} from './AppStateProvider';
import beep from './beep';

const truncate = (length: number) => <T>(array: T[]): T[] => {
  if (array.length > length) {
    return array.slice(array.length - length);
  } else {
    return array;
  }
};
const truncateMessages = truncate(100);

type WebsocketHandler = (
  state: AppState,
  message: any,
) => Partial<AppState> | null;

const messageHandler: WebsocketHandler = (state: AppState, message: any) => {
  if (message.Message) {
    return {messages: truncateMessages([...state.messages, message.Message])};
  } else {
    return null;
  }
};

const broadcastHandler: WebsocketHandler = (state: AppState, message: any) => {
  if (message.Broadcast) {
    const newMessage = {
      from: 'GAME',
      message: message.Broadcast.message,
      data: message.Broadcast.data,
      from_game: true,
    };
    return {messages: truncateMessages([...state.messages, newMessage])};
  } else {
    return null;
  }
};

const errorHandler: WebsocketHandler = (state: AppState, message: any) => {
  if (message.Error) {
    return {errors: [...state.errors, message.Error]};
  } else {
    return null;
  }
};

const stateHandler: WebsocketHandler = (state: AppState, message: any) => {
  if (message.State) {
    return {game_state: message.State.state, cards: message.State.cards};
  } else {
    return null;
  }
};

let lastBeeped = performance.now();
const beepHandler: WebsocketHandler = (state: AppState, message: any) => {
  if (message === 'Beep') {
    const now = performance.now();
    // Rate-limit beeps to prevent annoyance.
    if (now - lastBeeped >= 1000) {
      beep(3, 261.63, 200);
      lastBeeped = now;
    }
  }
  return null;
};

const gameFinishedHandler: WebsocketHandler = (
  state: AppState,
  message: any,
) => {
  if (
    message.Broadcast &&
    message.Broadcast.data.variant.type === 'GameFinished'
  ) {
    const ownResult = message.Broadcast.data.variant.result[state.name];
    if (ownResult) {
      const gameStatistics = state.gameStatistics;

      const newGameStatistics = {...gameStatistics};
      newGameStatistics.gamesPlayed++;
      if (ownResult.is_defending) {
        newGameStatistics.gamesPlayedAsDefending++;
        if (ownResult.is_landlord) {
          newGameStatistics.gamesPlayedAsLandlord++;
        }
      }

      if (ownResult.won_game) {
        newGameStatistics.gamesWon++;
        if (ownResult.is_defending) {
          newGameStatistics.gamesWonAsDefending++;
          if (ownResult.is_landlord) {
            newGameStatistics.gamesWonAsLandlord++;
          }
        }
      }

      newGameStatistics.ranksUp += ownResult.ranks_up;
      return {gameStatistics: newGameStatistics};
    }
  }
  return null;
};

const allHandlers: WebsocketHandler[] = [
  messageHandler,
  broadcastHandler,
  errorHandler,
  stateHandler,
  beepHandler,
  gameFinishedHandler,
];

const composedHandlers: WebsocketHandler = (state: AppState, message: any) => {
  let partials = {};
  allHandlers.forEach((h) => {
    const partial = h(state, message);
    partials = {...partials, ...partial};
    state = {...state, ...partial};
  });
  return partials;
};

export default composedHandlers as WebsocketHandler;
