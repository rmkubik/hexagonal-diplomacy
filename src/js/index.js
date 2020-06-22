import React, { useEffect } from "react";
import ReactDOM from "react-dom";
import * as firebase from "firebase/app";
import "firebase/firestore";
import "firebase/functions";
import "../styles/main.css";

const firebaseApp = firebase.initializeApp({
  apiKey: "AIzaSyCoqYxiG5xbPnzKu7Q0w2AULtuCJEygbBY",
  authDomain: "hexagonal-diplomacy.firebaseapp.com",
  databaseURL: "https://hexagonal-diplomacy.firebaseio.com",
  projectId: "hexagonal-diplomacy",
  storageBucket: "hexagonal-diplomacy.appspot.com",
  messagingSenderId: "718835873556",
  appId: "1:718835873556:web:993e2fd8f873277f577401",
});

const TILE_SCALE = 0.5;
const TILE_HEIGHT = 200;
const TILE_WIDTH = 174;
const TILE_HEIGHT_SCALED = TILE_SCALE * TILE_HEIGHT;
const TILE_WIDTH_SCALED = TILE_SCALE * TILE_WIDTH;
const ROW_OFFSET = 25;
const HEX_SIDE = 50;
const ICON_SIZE = 100;

function cubeRound(cube) {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const x_diff = Math.abs(rx - cube.x);
  const y_diff = Math.abs(ry - cube.y);
  const z_diff = Math.abs(rz - cube.z);

  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry - rz;
  } else if (y_diff > z_diff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

function cubeToAxial(cube) {
  const q = cube.x;
  const r = cube.z;

  return { q, r };
}

function axialToCube(hex) {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;

  return { x, y, z };
}

function cubeToOddR(cube) {
  var col = cube.x + (cube.z - (cube.z & 1)) / 2;
  var row = cube.z;
  return { col, row };
}

function axialToOddR(axial) {
  return cubeToOddR(axialToCube(axial));
}

function oddRToCube(hex) {
  const x = hex.col - (hex.row - (hex.row & 1)) / 2;
  const z = hex.row;
  const y = -x - z;

  return { x, y, z };
}

function hexRound(hex) {
  return cubeToAxial(cubeRound(axialToCube(hex)));
}

function pixelToPointyHex(point) {
  const q = ((Math.sqrt(3) / 3) * point.x - (1 / 3) * point.y) / HEX_SIDE;
  const r = ((2 / 3) * point.y) / HEX_SIDE;

  return hexRound({ q, r });
}

function pointyHexToPixel(hex) {
  const x = HEX_SIDE * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = HEX_SIDE * ((3 / 2) * hex.r);

  return { x, y };
}

function lerp(a, b, steps) {
  return a + (b - a) * steps;
}

function cubeLerp(a, b, steps) {
  return {
    x: lerp(a.x, b.x, steps),
    y: lerp(a.y, b.y, steps),
    z: lerp(a.z, b.z, steps),
  };
}

function constructMatrix({ width, height }, constructor) {
  const matrix = [];

  for (let row = 0; row < height; row++) {
    matrix[row] = [];
    for (let col = 0; col < width; col++) {
      matrix[row][col] = constructor({ row, col });
    }
  }

  return matrix;
}

function mapMatrix(matrix, mapFn) {
  return matrix.map((row, rowIndex) => {
    return row.map((col, colIndex) => {
      return mapFn(col, { row: rowIndex, col: colIndex }, matrix);
    });
  });
}

function constructMatrixFromTemplate(template, mapFn) {
  const charMatrix = template.split("\n").map((row) => row.split(" "));

  return mapMatrix(charMatrix, mapFn);
}

function areLocationsEqual(a, b) {
  return a.row === b.row && a.col === b.col;
}

function isLocationInArray(location, array) {
  return array.some((locationInArray) =>
    areLocationsEqual(location, locationInArray)
  );
}

function isTileUnit(tile) {
  switch (tile.icon) {
    case "⚔️":
      return true;
    default:
      return false;
  }
}

function getLocation(location = { row: -1, col: -1 }, matrix) {
  const row = matrix[location.row];

  if (!row) {
    return undefined;
  }

  return row[location.col];
}

const CUBE_DIRECTIONS = [
  { x: +1, y: -1, z: 0 },
  { x: +1, y: 0, z: -1 },
  { x: 0, y: +1, z: -1 },
  { x: -1, y: +1, z: 0 },
  { x: -1, y: 0, z: +1 },
  { x: 0, y: -1, z: +1 },
];

function getCubeDirection(direction) {
  return CUBE_DIRECTIONS[direction];
}

function subtractCubes(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function areCubesEqual(a, b) {
  return a.x === b.x && b.y === b.y && a.z === b.z;
}

function addCubes(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function getCubeNeighbor(cube, direction) {
  return addCubes(cube, direction);
}

function getCubeNeighbors(cube) {
  return CUBE_DIRECTIONS.map((direction) => getCubeNeighbor(cube, direction));
}

function getNeighbors(location, matrix) {
  // convert offset location to cube coords
  const cubeLocation = oddRToCube(location);
  // get neighbors
  const cubeNeighbors = getCubeNeighbors(cubeLocation);

  return cubeNeighbors.map((neighbor) => cubeToOddR(neighbor));
}

function getDimensions(matrix) {
  return {
    width: matrix[0].length,
    height: matrix.length,
  };
}

function isLocationInBounds(location, matrix) {
  const { width, height } = getDimensions(matrix);

  return (
    location.row >= 0 &&
    location.row < height &&
    location.col >= 0 &&
    location.col < width
  );
}

function getInBoundsNeighbors(location, matrix) {
  const neighbors = getNeighbors(location, matrix);

  return neighbors.filter((neighbor) => isLocationInBounds(neighbor, matrix));
}

function getUnitByLocation(location, players) {
  let unit;

  players.forEach((player) => {
    const foundUnit = player.units.find((unit) =>
      areLocationsEqual(unit.location, location)
    );

    if (foundUnit) {
      unit = foundUnit;
    }
  });

  return unit;
}

function update(updateFn, index, array) {
  return [
    ...array.slice(0, index),
    updateFn(array[index]),
    ...array.slice(index + 1),
  ];
}

function forEachUnit(players, callback) {
  players.forEach((player) => {
    player.units.forEach((unit) => callback(player, unit));
  });
}

function setUnitAction(id, action, players) {
  const playerIndex = players.findIndex((player) =>
    player.units.some((unit) => unit.id === id)
  );
  const unitIndex = players[playerIndex].units.findIndex(
    (unit) => unit.id === id
  );

  return update(
    (player) => ({
      ...player,
      units: update(
        (unit) => ({
          ...unit,
          action,
        }),
        unitIndex,
        player.units
      ),
    }),
    playerIndex,
    players
  );
}

function getDirectionOfNeighbor(a, b) {
  const aCube = oddRToCube(a);
  const bCube = oddRToCube(b);

  const difference = subtractCubes(aCube, bCube);

  return difference;
}

function cubeDirectionToAngle(direction) {
  const DIRECTION_MAP = [
    [{ x: +1, y: -1, z: 0 }, 90],
    [{ x: +1, y: 0, z: -1 }, 30],
    [{ x: 0, y: +1, z: -1 }, 330],
    [{ x: -1, y: +1, z: 0 }, 270],
    [{ x: -1, y: 0, z: +1 }, 210],
    [{ x: 0, y: -1, z: +1 }, 150],
  ];

  const match = DIRECTION_MAP.find(([mappedDirection]) =>
    areCubesEqual(mappedDirection, direction)
  );

  if (!match) {
    console.warn(`invalid direction: ${JSON.stringify(direction)}`);
    return;
  }

  return match[1];
}

const Input = ({ setSelected, children }) => {
  // keep ref of current setSelected fn so as it's bound
  // state updates, we can update the fn called by our
  // event listener
  const setSelectedRef = React.useRef();
  setSelectedRef.current = setSelected;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();

        // offset screen origin to hex origin
        const pixel = {
          x: e.pageX - TILE_WIDTH_SCALED / 2,
          y: e.pageY - TILE_HEIGHT_SCALED / 2,
        };

        const axial = pixelToPointyHex(pixel);
        setSelectedRef.current(axialToOddR(axial));
      }}
    >
      {children}
    </div>
  );
};

const DiagonalSvgPattern = () => {
  return (
    <svg>
      <pattern
        id="diagonalHatch"
        width="30"
        height="10"
        patternTransform="rotate(60 0 0)"
        patternUnits="userSpaceOnUse"
      >
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="10"
          style={{ stroke: "black", strokeWidth: 10, strokeOpacity: 0.4 }}
        />
      </pattern>
    </svg>
  );
};

const Hex = ({
  color,
  selected,
  scale,
  x = 0,
  y = 0,
  centered = false,
  icon,
  location,
  action,
}) => {
  return (
    <div
      style={{
        transformOrigin: "top left",
        transform: `scale(${scale})`,
        position: "absolute",
        top: centered ? y - TILE_HEIGHT_SCALED / 2 : y,
        left: centered ? x - TILE_WIDTH_SCALED / 2 : x,
      }}
    >
      <div className={`hex`}>
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          width={TILE_WIDTH}
          height={TILE_HEIGHT}
          viewBox="0 0 173.20508075688772 200"
        >
          <path
            style={{
              fill: color,
            }}
            d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z"
          ></path>
          <path
            className={selected ? "selected" : ""}
            fill="none"
            d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z"
          ></path>
        </svg>
        <p
          style={{
            top: 40, // TILE_HEIGHT_SCALED - ICON_SIZE,
            left: 34, // TILE_WIDTH_SCALED / 2,
            fontSize: ICON_SIZE,
          }}
        >
          {icon}
        </p>
        {action && action.icon && (
          <>
            <p
              style={{
                top: 40, // TILE_HEIGHT_SCALED - ICON_SIZE,
                left: 34, // TILE_WIDTH_SCALED / 2,
                fontSize: ICON_SIZE / 2,
                borderRadius: "50%",
                backgroundColor: "white",
                padding: "2px",
              }}
            >
              {action.icon}
            </p>
            {/*<span>
              {JSON.stringify(
                pointyHexToPixel(cubeToAxial(oddRToCube(action.target)))
              )}
            </span>*/}
          </>
        )}
      </div>
    </div>
  );
};

const HexGrid = ({ tiles, selected, players, selectedAction }) => {
  const actions = [];
  forEachUnit(players, (player, unit) => {
    if (!unit.action.target) {
      return;
    }
    const pixel = pointyHexToPixel(cubeToAxial(oddRToCube(unit.location)));
    const angle = cubeDirectionToAngle(
      getDirectionOfNeighbor(unit.action.target, unit.location)
    );

    actions.push(
      <span
        style={{
          top: pixel.y + 34, // TILE_HEIGHT_SCALED - ICON_SIZE,
          left: pixel.x + 24, // TILE_WIDTH_SCALED / 2,
          fontSize: ICON_SIZE / 4,
          transformOrigin: "center center",
          transform: `rotate(${angle}deg) translate(0px, -54px)`,
          zIndex: 100,
          position: "absolute",
        }}
      >
        ⬆
      </span>
    );
  });

  return (
    <>
      <div>
        {tiles.map((row, rowIndex) => {
          return row.map((hex, colIndex) => {
            const x =
              rowIndex % 2 === 0
                ? TILE_WIDTH_SCALED * colIndex
                : TILE_WIDTH_SCALED * colIndex + TILE_WIDTH_SCALED / 2;

            const y = TILE_HEIGHT_SCALED * rowIndex - ROW_OFFSET * rowIndex;

            let owner = players.find((player) =>
              isLocationInArray({ row: rowIndex, col: colIndex }, player.tiles)
            );

            if (!owner) {
              // if no player owns, set this tile to be "owned" by neutral
              owner = {
                colors: {
                  light: "#d1d1d1",
                  dark: "#b1b1b1",
                },
              };
            }

            const color =
              colIndex % 2 === 0 ? owner.colors.dark : owner.colors.light;

            // is this tile selected?
            let highlight = areLocationsEqual(selected, {
              row: rowIndex,
              col: colIndex,
            });

            // is this tile a neighbor or a selected tile while there is a selectedAction?
            const neighbors = getInBoundsNeighbors(selected, tiles);

            if (
              selectedAction.id &&
              isLocationInArray({ row: rowIndex, col: colIndex }, neighbors)
            ) {
              highlight = true;
            }

            // does current hex have a unit on it?
            const currentUnit = getUnitByLocation(
              { row: rowIndex, col: colIndex },
              players
            );

            const icon = currentUnit ? "⚔️" : hex.icon;
            const action = currentUnit && currentUnit.action;

            return (
              <Hex
                scale={0.5}
                selected={highlight}
                color={color}
                x={x}
                y={y}
                {...hex}
                icon={icon} // replace icon with icon inside of hex
                action={action}
                location={{ row: rowIndex, col: colIndex }}
              />
            );
          });
        })}
      </div>
      <div className="overlay">{actions}</div>
    </>
  );
};

const tileMapper = (char) => (char !== "." ? { icon: char } : { icon: "" });
const initialTiles = constructMatrixFromTemplate(
  `. . . . . . .
. . . . . . .
. . . . . . .
. . . . . . .
. . . . . . .`,
  tileMapper
);

const ActionButton = ({ children, onClick }) => {
  return (
    <button className="action-button" onClick={onClick}>
      {children}
    </button>
  );
};

const ActionButtons = ({ show = true, selected, setSelectedAction }) => {
  const x =
    selected.row % 2 === 0
      ? TILE_WIDTH_SCALED * selected.col
      : TILE_WIDTH_SCALED * selected.col + TILE_WIDTH_SCALED / 2;

  const y =
    TILE_HEIGHT_SCALED * selected.row -
    ROW_OFFSET * selected.row -
    TILE_WIDTH_SCALED / 2;

  return show ? (
    <div
      className="action-buttons"
      style={{
        top: y,
        left: x,
      }}
    >
      <ActionButton
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAction({ id: "move", icon: "🥾" });
        }}
      >
        🥾
      </ActionButton>
      <ActionButton
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAction({ id: "support", icon: "➕" });
        }}
      >
        ➕
      </ActionButton>
      <ActionButton
        onClick={(e) => {
          e.stopPropagation();
          setSelectedAction({ id: "hold", icon: "🛡" });
        }}
      >
        🛡
      </ActionButton>
    </div>
  ) : null;
};

const App = () => {
  const [tiles, setTiles] = React.useState(initialTiles);
  const [selected, setSelected] = React.useState({ row: -1, col: -1 });
  const [selectedAction, setSelectedAction] = React.useState({});
  const [players, setPlayers] = React.useState([
    {
      name: "Bob",
      id: "asdf-1234-dore-mi12",
      tiles: [
        { row: 4, col: 3 },
        { row: 3, col: 3 },
        { row: 2, col: 3 },
        { row: 3, col: 2 },
        { row: 2, col: 2 },
      ],
      colors: {
        light: "lightpink",
        dark: "salmon",
      },
      units: [
        {
          id: "asdf-1234-asdf-1234",
          key: "soldier",
          location: { row: 2, col: 3 },
          action: {},
        },
      ],
    },
    {
      name: "Sally",
      id: "1234-5678-dore-mi12",
      tiles: [
        { row: 0, col: 3 },
        { row: 1, col: 3 },
        { row: 1, col: 4 },
        { row: 0, col: 2 },
        { row: 1, col: 2 },
      ],
      colors: {
        light: "lightblue",
        dark: "skyblue",
      },
      units: [
        {
          id: "asdf-5678-asdf-5678",
          key: "soldier",
          location: { row: 1, col: 3 },
          action: {},
        },
      ],
    },
  ]);

  useEffect(() => {
    var readGame = firebase.functions().httpsCallable("readGame");

    readGame()
      .then(({ data }) => {
        const newLinedTiles = data.tiles.replace(/\\n/g, "\n");
        const newPlayers = data.players.map((player) => ({
          ...player,
          units: player.units.map((unit) => ({ ...unit, action: {} })),
        }));

        setPlayers(newPlayers);
        setTiles(constructMatrixFromTemplate(newLinedTiles, tileMapper));
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  const dimensions = getDimensions(tiles);

  const select = (newSelected) => {
    if (areLocationsEqual(selected, newSelected)) {
      setSelected({ row: -1, col: -1 });
      setSelectedAction({});
    } else if (selectedAction.id) {
      const newPlayers = setUnitAction(
        getUnitByLocation(selected, players).id,
        { ...selectedAction, target: newSelected },
        players
      );
      console.log(
        `${JSON.stringify(selected)} - ${selectedAction.id} - ${JSON.stringify(
          newSelected
        )}`
      );
      setPlayers(newPlayers);
      setSelected({ row: -1, col: -1 });
      setSelectedAction({});
    } else {
      setSelected(newSelected);
    }
  };

  const selectedTile = getLocation(selected, tiles);

  return (
    <Input setSelected={select}>
      <div className="main">
        <div
          style={{
            position: "relative",
            height: `${TILE_HEIGHT_SCALED * dimensions.height}px`,
            width: `${
              TILE_WIDTH_SCALED * dimensions.width + TILE_WIDTH_SCALED / 2
            }px`,
          }}
        >
          <DiagonalSvgPattern />
          <HexGrid
            selectedAction={selectedAction}
            selected={selected}
            tiles={tiles}
            players={players}
          />
          <ActionButtons
            show={
              selectedTile &&
              Boolean(getUnitByLocation(selected, players)) &&
              !selectedAction.id
            }
            selected={selected}
            setSelectedAction={setSelectedAction}
          />
        </div>
        <button
          className="submit"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          Submit Orders
        </button>
        {/*<pre style={{ position: "absolute" }}>
        {JSON.stringify(
          {
            selected,
            selectedTile,
            selectedAction,
            selectedUnit: getUnitByLocation(selected, players),
            players
          },
          undefined,
          2
        )}
      </pre>*/}
      </div>
    </Input>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
