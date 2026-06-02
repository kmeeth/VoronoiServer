import { useEffect, useMemo, useRef, useState } from "react";
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
import { Palette } from "../components/Palette";
import { HslSliders } from "../components/HslSliders";
import { hslToString, randomHSL, type HSL } from "../utils/colors";
import { letterboxToViewBox, nearestPointId } from "../utils/geometry";

const WIDTH = 800;
const HEIGHT = 600;
const POINT_RADIUS = 4;
const DELETE_COLOR = "#e11d48";
// How long a press must dwell before previewing the cell it would delete —
// long enough to skip incidental taps, short enough to telegraph the delete.
const PREVIEW_DELAY = 180;

export default function HomeScreen() {
  const utils = trpc.useUtils();
  // Pull model: poll the shared point set so other clients' changes appear, and
  // invalidate on mutation success so your own edits show up immediately.
  const pointsQuery = trpc.getPoints.useQuery(undefined, {
    refetchInterval: 1500,
  });
  const invalidatePoints = () => utils.getPoints.invalidate();
  const addPoint = trpc.addPoint.useMutation({ onSuccess: invalidatePoints });
  const deletePoint = trpc.deletePoint.useMutation({
    onSuccess: invalidatePoints,
  });

  const points = pointsQuery.data;

  const [selected, setSelected] = useState<HSL>(() => randomHSL());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Map a press into viewBox coordinates. Prefer locationX/locationY — relative
  // to the canvas and free of the status-bar/header offset measureInWindow can
  // introduce on Android. react-native-web leaves them empty for synthetic
  // touch, so fall back to absolute pageX/pageY minus the measured canvas
  // position there. The letterbox inversion lives in the tested geometry helper.
  const toViewBox = (e: GestureResponderEvent): { x: number; y: number } | null => {
    const { x: rx, y: ry, width: cw, height: ch } = canvasRect.current;
    const ne = e.nativeEvent;
    const hasLocal =
      Number.isFinite(ne.locationX) && Number.isFinite(ne.locationY);
    const localX = hasLocal ? ne.locationX : ne.pageX - rx;
    const localY = hasLocal ? ne.locationY : ne.pageY - ry;
    return letterboxToViewBox(localX, localY, cw, ch, WIDTH, HEIGHT);
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

  const clearPreview = () => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPendingDeleteId(null);
  };

  // Telegraph which cell a sustained press will delete, once it has dwelled
  // past PREVIEW_DELAY (so a quick tap-to-add never flashes it).
  const handlePressIn = (e: GestureResponderEvent) => {
    const p = toViewBox(e);
    if (!p) return;
    previewTimer.current = setTimeout(() => {
      setPendingDeleteId(nearestPointId(points ?? [], p.x, p.y));
    }, PREVIEW_DELAY);
  };

  const handleLongPress = (e: GestureResponderEvent) => {
    const p = toViewBox(e);
    if (!p) return;
    const id = nearestPointId(points ?? [], p.x, p.y);
    if (id) deletePoint.mutate({ id });
  };

  useEffect(() => () => clearPreview(), []);

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
      <HslSliders selected={selected} onChange={setSelected} />
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
        onPressIn={handlePressIn}
        onPressOut={clearPreview}
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
                stroke={c.id === pendingDeleteId ? DELETE_COLOR : "#333"}
                strokeWidth={c.id === pendingDeleteId ? 4 : 1}
              />
            ) : null,
          )}
          {cells?.map((c) => (
            <Circle
              key={`pt-${c.id}`}
              cx={c.x}
              cy={c.y}
              r={c.id === pendingDeleteId ? POINT_RADIUS + 1 : POINT_RADIUS}
              fill="#fff"
              stroke={c.id === pendingDeleteId ? DELETE_COLOR : "#222"}
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
