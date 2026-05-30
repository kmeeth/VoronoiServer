import { Pressable, Text, View, StyleSheet } from "react-native";
import {
  buildPalette,
  hslToString,
  sameHSL,
  type HSL,
} from "../utils/colors";

// Swatch grid that re-pivots around whichever colour is picked, plus a random
// tile. Mirrors the web client's palette UX with native primitives.
export function Palette({
  selected,
  onPick,
  onRandom,
}: {
  selected: HSL;
  onPick: (c: HSL) => void;
  onRandom: () => void;
}) {
  const palette = buildPalette(selected);

  return (
    <View style={styles.row}>
      {palette.map((c, i) => {
        const css = hslToString(c);
        const isSel = sameHSL(c, selected);
        return (
          <Pressable
            key={i}
            onPress={() => onPick(c)}
            style={[
              styles.swatch,
              { backgroundColor: css },
              isSel && styles.selected,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Select color ${css}`}
          />
        );
      })}
      <Pressable
        onPress={onRandom}
        style={[styles.swatch, styles.random]}
        accessibilityRole="button"
        accessibilityLabel="Random color"
      >
        <Text style={styles.dice}>🎲</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbb",
  },
  selected: {
    borderWidth: 3,
    borderColor: "#111",
  },
  random: {
    borderStyle: "dashed",
    borderColor: "#888",
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  dice: {
    fontSize: 18,
  },
});
