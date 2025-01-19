import React, { useState, useEffect } from 'react';          // Import React and useState to manage state
import { Chessboard } from 'react-chessboard';    // Import Chessboard component from react-chessboard
import { Chess } from 'chess.js';                 // Import Chess logic from chess.js
import './App.css';

const App = () => {
  // Initialize game state with a new Chess instance from chess.js
  const [game, setGame] = useState(new Chess());
  // Initialize state for the Stockfish Web Worker instance
  const [stockfish, setStockfish] = useState(null);
  // Initialize state for storing Stockfish's suggested best move
  const [bestMove, setBestMove] = useState("");

  // useEffect to set up Stockfish as a Web Worker when the component first loads (mounts)
  useEffect(() => {
    // Create a new Web Worker for Stockfish from the JavaScript file we downloaded
    const stockfishWorker = new Worker("/js/stockfish-16.1-lite-single.js");
    setStockfish(stockfishWorker); // Save this worker instance in state for access elsewhere in the component

    // Listen for messages sent back from Stockfish
    stockfishWorker.onmessage = (event) => {
      const message = event.data; // Capture the message data from Stockfish
      // Check if Stockfish has sent a "bestmove" response
      if (message.startsWith("bestmove")) {
        const move = message.split(" ")[1]; // Extract the best move from the message
        setBestMove(move); // Save the best move in state to display on the screen
      }
    };

    // Send the initial board position to Stockfish
    stockfishWorker.postMessage(`position fen ${game.fen()}`);
    stockfishWorker.postMessage("go depth 15");

    // Clean up the worker when the component is removed from the screen (unmounted)
    return () => {
      stockfishWorker.terminate(); // Terminates the worker to free up resources
    };
  }, [game]); // Empty dependency array means this runs only once when the component mounts

  // onDrop function is triggered when a piece is moved on the Chessboard
  const onDrop = (sourceSquare, targetSquare) => {
    // Create a copy of the current game state using FEN (Forsyth-Edwards Notation)
    const gameCopy = new Chess(game.fen());

    try {
      // Attempt to make the move on the game copy
      const move = gameCopy.move({
        from: sourceSquare,   // Source square of the piece being moved
        to: targetSquare,     // Target square of the move
        promotion: "q",       // Always promote to a queen for simplicity
      });

      // If the move is invalid, return false to prevent it from being applied
      if (move === null) {
        return false; // Invalid move, ignore it
      }

      // If the move is valid, update the main game state with the new position
      setGame(gameCopy);

      // Send the new position to Stockfish for analysis
      if (stockfish) {
        stockfish.postMessage(`position fen ${gameCopy.fen()}`); // Send the board position in FEN format
        stockfish.postMessage("go depth 15"); // Instruct Stockfish to analyze the position up to a depth of 15 moves
      }

      return true; // Move was valid and applied, so return true
    } catch (error) {
      console.error(error.message); // Log any errors
      return false; // Return false to ignore the move if there was an error
    }
  };

  // Render the component
  return (
    <div>
      <h1>Chess Game with Stockfish</h1>
      <Chessboard
        position={game.fen()}         // Set the board position based on the current game state
        onPieceDrop={onDrop}          // Attach the onDrop function to handle piece moves
        boardWidth={600}              // Set the width of the chessboard to 500 pixels
      />
      <div>
        {/* Display Stockfish's suggested best move or show "Calculating..." if no move is available yet */}
        <h3>Best Move: {bestMove || "Calculating..."}</h3>
      </div>
    </div>
  );
};

export default App; // Export the App component for use in other parts of the application