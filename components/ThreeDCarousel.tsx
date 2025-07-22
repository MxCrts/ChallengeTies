import React, { useEffect, useRef } from "react";
import { View, FlatList, Dimensions, StyleSheet, TouchableOpacity } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Props<T> = {
  data: T[];
  renderItem: (params: { item: T; index: number }) => React.ReactNode;
  itemWidth: number;
  spacing: number;
  autoRotateInterval?: number;
};

export default function ThreeDCarousel<T>({
  data,
  renderItem,
  itemWidth,
  spacing,
  autoRotateInterval = 4000,
}: Props<T>) {
  const flatListRef = useRef<FlatList<T>>(null);
  const totalItemWidth = itemWidth + spacing;
  const sidePadding = (SCREEN_WIDTH - itemWidth) / 2;
  let index = 0;

  // Init scroll au montage
  useEffect(() => {
    flatListRef.current?.scrollToIndex({
      index: 0,
      animated: false,
      viewPosition: 0.5,
    });
  }, []);

  // Auto-scroll piloté
  useEffect(() => {
    const interval = setInterval(() => {
      index = (index + 1) % data.length;
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }, autoRotateInterval);
    return () => clearInterval(interval);
  }, []);

  // Après swipe manuel : recadrage précis
  const handleMomentumEnd = (e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / totalItemWidth);
    index = idx;
    flatListRef.current?.scrollToIndex({
      index: idx,
      animated: true,
      viewPosition: 0.5,
    });
  };

  return (
    <FlatList
      ref={flatListRef}
      data={data}
      keyExtractor={(_, i) => i.toString()}
      renderItem={({ item, index }) => (
        <View style={{ width: itemWidth, marginHorizontal: spacing / 2 }}>
          {renderItem({ item, index })}
        </View>
      )}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToAlignment="center"
      contentContainerStyle={{ paddingHorizontal: sidePadding }}
      onMomentumScrollEnd={handleMomentumEnd}
    />
  );
}
