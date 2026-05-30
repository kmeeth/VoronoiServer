import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polygon, Circle, Rect } from "react-native-svg";
import { Delaunay } from "d3-delaunay";
import { trpc } from "../utils/trpc";
import { useRealtimePoints } from "../utils/useRealtimePoints";

const WIDTH = 800;
const HEIGHT = 600;
const POINT_RADIUS = 4;

export default function HomeScreen() {
  useRealtimePoints();

  const pointsQuery = trpc.getPoints.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const points = pointsQuery.data;

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
      <Text style={styles.status}>
        {pointsQuery.isLoading
          ? "loading…"
          : pointsQuery.error
            ? `error: ${pointsQuery.error.message}`
            : `${points?.length ?? 0} points`}
      </Text>
      <View style={styles.canvas}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fafafa",
  },
  status: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  canvas: {
    flex: 1,
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
});
