import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import './App.css';

const App = () => {
    const [game, setGame] = useState(new Chess());
    const [stockfish, setStockfish] = useState(null);
    const [bestMove, setBestMove] = useState("");
    const [principalVariations, setPrincipalVariations] = useState([]);


    const sendStockfishCommand = (stockfish, fen) => {
        if (!stockfish) return;
        stockfish.postMessage(`position fen ${fen}`);
        stockfish.postMessage("multipv 3");
        stockfish.postMessage("go depth 25");
    };


   const parseStockfishOutput = (message, game) => {
        if (!message.startsWith("info depth")) return null;

        const pvMatch = message.match(/pv (.+)/);
       let movesString = "";
       if (pvMatch)
       {
         movesString =  pvMatch[1].trim();
       } else {
           const parts = message.split(" ");
            movesString = parts.slice(10).join(" ");
       }

         const uciMoves = movesString.split(" ");
          const tempGame = new Chess(game.fen());
           let formattedMoves = "";
                for(let j=0; j < uciMoves.length; j++) {
                     const sanMove = tempGame.move({
                        from: uciMoves[j].slice(0, 2),
                        to: uciMoves[j].slice(2, 4),
                        promotion: "q",
                        });
                     if(sanMove === null) break;
                       formattedMoves += sanMove.san + " ";
                 }
                const turn = tempGame.turn();
                const turnText = turn === "w" ? "White to play - " : "Black to play - ";
                return [turnText + formattedMoves];
    };

    useEffect(() => {
        let maxDepth = 0;
        const tempVariations = new Map();

        const stockfishWorker = new Worker("/js/stockfish-16.1-lite-single.js");
        setStockfish(stockfishWorker);


        stockfishWorker.onmessage = (event) => {
            const message = event.data;

           if (message.startsWith("info depth")) {
              console.log("message: " + message);
              const parts = message.split(" ");
                const depth = parseInt(parts[2], 10);
               if(depth > maxDepth) {
                  maxDepth = depth;
               }
               console.log("depth: " + depth);
               console.log("maxDepth: " + maxDepth)


                const scorePart = message.split("score ");
                 if(scorePart.length < 2) return;

              let score = 0;
               const scoreTypePart = scorePart[1].split(" ");
                if(scoreTypePart.length < 2) return;

                const scoreType = scoreTypePart[1];
                let scoreText = "";

                   if(scoreType === 'cp') {
                     const scoreVal = parseInt(scoreTypePart[2], 10);
                     scoreText = (scoreVal > 0 ? '+' : '') +  (scoreVal/100).toFixed(1);
                      score = scoreVal;

                   }
                    else if(scoreType === 'mate') {
                        const scoreVal = parseInt(scoreTypePart[2], 10);
                       scoreText = (scoreVal > 0 ? '#' : '#') +  scoreVal;
                      score = 100000 * (scoreVal > 0 ? 1 : -1) + scoreVal ;
                   }
                    else {
                        return;
                  }
                const variation = parseStockfishOutput(message, game);
                 console.log("variation: " + variation);


                 if (variation && variation.length > 0 )
                 {
                      const pvIndexMatch = message.match(/multipv (\d+)/);
                     if (!pvIndexMatch) return;
                       const pvIndex = parseInt(pvIndexMatch[1], 10);
                        tempVariations.set(pvIndex, {
                            pv: variation[0],
                             score: score,
                            scoreText: scoreText,
                        });
                 }
              if (depth >= 25) {
              const allVariations = Array.from(tempVariations.values());
                 allVariations.sort((a, b) => b.score - a.score);
                    const top3Variations = allVariations.slice(0, 3).map((x) => `${x.scoreText} ${x.pv}`);
                     console.log("top3Variations: " + top3Variations)
                   setPrincipalVariations(top3Variations);
               }
           }
            if(message.startsWith("bestmove")){
                 const moveUCI = message.split(" ")[1];
               if (!moveUCI) return;

               const tempGame = new Chess(game.fen());
                const sanMove = tempGame.move({
                  from: moveUCI.slice(0, 2),
                   to: moveUCI.slice(2, 4),
                  promotion: "q",
                });
              if (sanMove === null) return;
                const turn = game.turn();
                const turnText = turn === "w" ? "White to play - " : "Black to play - ";
                const formattedMove = turnText + sanMove.san;
               setBestMove(formattedMove);
            }
        };


       sendStockfishCommand(stockfishWorker, game.fen());


        return () => {
            stockfishWorker.terminate();
        };
    }, [game]);


    const onDrop = (sourceSquare, targetSquare) => {
        const gameCopy = new Chess(game.fen());
        try {
            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: "q",
            });
            if (move === null) {
                return false;
            }

            setGame(gameCopy);

          sendStockfishCommand(stockfish, gameCopy.fen());
            return true;
        } catch (error) {
           console.error(error.message);
            return false;
        }
    };

    return (
        <div>
            <h1>Chess Game with Stockfish</h1>
            <Chessboard
                position={game.fen()}
                onPieceDrop={onDrop}
                boardWidth={600}
            />
            <div>
              <h3>Best Move: {bestMove || "Calculating..."}</h3>
                { game.turn() === 'w' ? <div>White to move:</div> : <div>Black to move:</div> }
                <ul>
                    {principalVariations.map((variation, index) => (
                       <li key={index}>{variation}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default App;