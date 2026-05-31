import { useRef } from "react";
import {
  View,
  Text,
  PanResponder,
  StyleSheet,
  type LayoutChangeEvent,
} from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Line,
} from "react-native-svg";
import { hslToString, type HSL } from "../utils/colors";

const TRACK_HEIGHT = 24;

// A single gradient track. Tap or drag anywhere along it to set the channel —
// the value is `locationX / width * max`. `stops` are evenly spaced colours
// describing the gradient.
function ColorSlider({
  label,
  value,
  max,
  stops,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  stops: string[];
  onChange: (v: number) => void;
}) {
  const widthRef = useRef(0);
  // Keep the latest callback/max reachable from the (once-created) responder.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const maxRef = useRef(max);
  maxRef.current = max;

  const setFromX = (locationX: number) => {
    const w = widthRef.current;
    if (!w) return;
    const t = Math.max(0, Math.min(1, locationX / w));
    onChangeRef.current(t * maxRef.current);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  const w = widthRef.current || 1;
  const thumbX = Math.max(0, Math.min(1, value / max)) * w;
  const gradId = `grad-${label}`;

  return (
    <View style={styles.sliderRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track} onLayout={onLayout} {...pan.panHandlers}>
        <Svg width="100%" height={TRACK_HEIGHT}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              {stops.map((color, i) => (
                <Stop
                  key={i}
                  offset={stops.length === 1 ? 0 : i / (stops.length - 1)}
                  stopColor={color}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width="100%"
            height={TRACK_HEIGHT}
            rx={6}
            fill={`url(#${gradId})`}
            stroke="#bbb"
            strokeWidth={1}
          />
          <Line
            x1={thumbX}
            y1={0}
            x2={thumbX}
            y2={TRACK_HEIGHT}
            stroke="#000"
            strokeWidth={3}
          />
          <Line
            x1={thumbX}
            y1={0}
            x2={thumbX}
            y2={TRACK_HEIGHT}
            stroke="#fff"
            strokeWidth={1}
          />
        </Svg>
      </View>
    </View>
  );
}

// Hue / saturation / lightness sliders for arbitrary colour selection, the
// mobile counterpart to the web client's native colour input. The S and L
// tracks reflect the current hue so the preview is accurate.
export function HslSliders({
  selected,
  onChange,
}: {
  selected: HSL;
  onChange: (c: HSL) => void;
}) {
  const { h, s, l } = selected;
  return (
    <View style={styles.container}>
      <ColorSlider
        label="H"
        value={h}
        max={360}
        stops={[
          "hsl(0,100%,50%)",
          "hsl(60,100%,50%)",
          "hsl(120,100%,50%)",
          "hsl(180,100%,50%)",
          "hsl(240,100%,50%)",
          "hsl(300,100%,50%)",
          "hsl(360,100%,50%)",
        ]}
        onChange={(v) => onChange({ h: v, s, l })}
      />
      <ColorSlider
        label="S"
        value={s}
        max={100}
        stops={[hslToString({ h, s: 0, l }), hslToString({ h, s: 100, l })]}
        onChange={(v) => onChange({ h, s: v, l })}
      />
      <ColorSlider
        label="L"
        value={l}
        max={100}
        stops={[
          hslToString({ h, s, l: 0 }),
          hslToString({ h, s, l: 50 }),
          hslToString({ h, s, l: 100 }),
        ]}
        onChange={(v) => onChange({ h, s, l: v })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    width: 16,
    fontSize: 13,
    fontWeight: "600",
    color: "#444",
  },
  track: {
    flex: 1,
    height: TRACK_HEIGHT,
  },
});
