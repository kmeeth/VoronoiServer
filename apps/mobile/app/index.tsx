import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  type GestureResponderEvent,
} from "react-native";
import Svg, { Polygon, Circle, Rect } from "react-native-svg";
import { Delaunay } from "d3-delaunay";
import { trpc } from "../utils/trpc";
import { useRealtimePoints } from "../utils/useRealtimePoints";
import { Palette } from "../components/Palette";
import { hslToString, randomHSL, type HSL } from "../utils/colors";

const WIDTH = 800;
const HEIGHT = 600;
const POINT_RADIUS = 4;

export default function HomeScreen() {
  useRealtimePoints();

  const pointsQuery = trpc.getPoints.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const addPoint = trpc.addPoint.useMutation();
  const deletePoint = trpc.deletePoint.useMutation();

  const points = pointsQuery.data;

  const [selected, setSelected] = useState<HSL>(() => randomHSL());

  // The canvas renders the 800×600 viewBox letterboxed (xMidYMid meet) into a
  // flex-sized View, so screen-space presses must be mapped back into viewBox
  // coordinates. We measure the View's window rect on layout for its size (and
  // as a web fallback for position).
  const canvasRef = useRef<View>(null);
  const canvasRect = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const onCanvasLayout = () => {
    canvasRef.current?.measureInWindow((x, y, width, height) => {
      canvasRect.current = { x, y, width, height };
    });
  };

  // Invert the letterbox transform; returns null for presses in the margins.
  const toViewBox = (e: GestureResponderEvent): { x: number; y: number } | null => {
    const { x: rx, y: ry, width: cw, height: ch } = canvasRect.current;
    if (cw === 0 || ch === 0) return null;
    // Prefer locationX/locationY — they're relative to the canvas and free of
    // the status-bar/header offset that measureInWindow can introduce on
    // Android. react-native-web leaves them empty for synthetic touch, so fall
    // back to absolute pageX/pageY minus the measured canvas position there.
    const ne = e.nativeEvent;
    const hasLocal =
      Number.isFinite(ne.locationX) && Number.isFinite(ne.locationY);
    const localX = hasLocal ? ne.locationX : ne.pageX - rx;
    const localY = hasLocal ? ne.locationY : ne.pageY - ry;
    const scale = Math.min(cw / WIDTH, ch / HEIGHT);
    const offsetX = (cw - WIDTH * scale) / 2;
    const offsetY = (ch - HEIGHT * scale) / 2;
    const x = (localX - offsetX) / scale;
    const y = (localY - offsetY) / scale;
    if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) return null;
    return { x, y };
  };

  const handleAdd = (e: GestureResponderEvent) => {
    const p = toViewBox(e);
    if (!p) return;
    // addPoint's input schema requires integer coordinates.
    addPoint.mutate({
      x: Math.round(p.x),
      y: Math.round(p.y),
      color: hslToString(selected),
    });
  };

  // A Voronoi cell is the region nearest its seed, so the cell under a press is
  // simply the closest seed — no per-polygon hit test needed.
  const handleLongPress = (e: GestureResponderEvent) => {
    const p = toViewBox(e);
    if (!p || !points || points.length === 0) return;
    let nearestId: string | null = null;
    let best = Infinity;
    for (const pt of points) {
      const d = (pt.x - p.x) ** 2 + (pt.y - p.y) ** 2;
      if (d < best) {
        best = d;
        nearestId = pt.id;
      }
    }
    if (nearestId) deletePoint.mutate({ id: nearestId });
  };

  const cells = useMemo(() => {
    if (!points || points.length === 0) return null;
    const delaunay = Delaunay.from(
      points,
      (p) => p.x,
      (p) => p.y,
    );
    const voronoi = delaunay.voronoi([0, 0, WIDTH, HEIGHT]);
    return points.map((p, i) => ({
      id: p.id,
      color: p.color,
      x: p.x,
      y: p.y,
      polygon: voronoi.cellPolygon(i),
    }));
  }, [points]);

  return (
    <View style={styles.container}>
      <Palette
        selected={selected}
        onPick={setSelected}
        onRandom={() => setSelected(randomHSL())}
      />
      <Text style={styles.status}>
        {pointsQuery.isLoading
          ? "loading…"
          : pointsQuery.error
            ? `error: ${pointsQuery.error.message}`
            : `${points?.length ?? 0} points · tap to add · long-press to remove`}
      </Text>
      <Pressable
        ref={canvasRef}
        style={styles.canvas}
        onLayout={onCanvasLayout}
        onPress={handleAdd}
        onLongPress={handleLongPress}
        delayLongPress={350}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="#fff" />
          {cells?.map((c) =>
            c.polygon ? (
              <Polygon
                key={`cell-${c.id}`}
                points={c.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                fill={c.color}
                stroke="#333"
                strokeWidth={1}
              />
            ) : null,
          )}
          {cells?.map((c) => (
            <Circle
              key={`pt-${c.id}`}
              cx={c.x}
              cy={c.y}
              r={POINT_RADIUS}
              fill="#fff"
              stroke="#222"
              strokeWidth={1.5}
            />
          ))}
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
    backgroundColor: "#fafafa",
  },
  status: {
    fontSize: 14,
    color: "#666",
  },
  canvas: {
    flex: 1,
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
});
