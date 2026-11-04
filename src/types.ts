export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type PieceColor = 'w' | 'b';

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  r: number;
  c: number;
  hasMoved?: boolean;
}

export interface MoveCoordinate {
  r: number;
  c: number;
  capture?: boolean;
  castle?: 'k' | 'q';
}

export interface ScoreState {
  whiteWins: number;
  blackWins: number;
  draws: number;
}

export interface MultiplayerState {
  isMultiplayer: boolean;
  roomCode: string;
  isHost: boolean;
  isConnected: boolean;
  playerSide: PieceColor;
  isMicActive: boolean;
  localVolume: number;
  remoteSpeaking: boolean;
}
