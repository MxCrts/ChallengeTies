// components/ThreeDCarousel.tsx

import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  View,
  ViewStyle,
  Platform,
  StyleSheet,
  FlatList,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

type ThreeDCarouselProps<T> = {
  data: T[];
  renderItem: (params: { item: T; index: number }) => React.ReactNode;
  /** largeur de chaque item (défaut responsive) */
  itemWidth?: number;
  /** espacement horizontal entre items (défaut : 20) */
  spacing?: number;
  /** intervalle auto-rotation en ms (défaut : 4000) */
  autoRotateInterval?: number;
  /** couleur des dots (défaut : '#888') */
  dotColor?: string;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Largeur par défaut : 80% écran, max 300
const DEFAULT_ITEM_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 300);
const DEFAULT_SPACING = 20;
const DOT_SIZE = 8;
const DOT_SPACING = 8;

export default function ThreeDCarousel<T>({
  data,
  renderItem,
  itemWidth = DEFAULT_ITEM_WIDTH,
  spacing = DEFAULT_SPACING,
  autoRotateInterval = 4000,
  dotColor = '#888',
}: ThreeDCarouselProps<T>) {
  const totalItemWidth = itemWidth + spacing;
  const scrollX = useSharedValue(0);
  const listRef = useRef<FlatList<T>>(null);

  // Pour centrer la première et dernière carte
  const sidePadding = (SCREEN_WIDTH - itemWidth) / 2;

  // Pré-calcule des offsets pour un centrage parfait
  const snapOffsets = data.map((_, i) => i * totalItemWidth);

  // ScrollHandler Reanimated
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  // Auto-scroll : on utilise scrollToIndex avec viewPosition=0.5
  useEffect(() => {
    if (data.length < 2) return;
    const id = setInterval(() => {
      // calcule l’index actuel
      const position = scrollX.value / totalItemWidth;
      const next = (Math.round(position) + 1) % data.length;
      listRef.current?.scrollToIndex({
        index: next,
        animated: true,
        viewPosition: 0.5,      // centre l’élément
      });
    }, autoRotateInterval);
    return () => clearInterval(id);
  }, [data.length, totalItemWidth, autoRotateInterval]);

  // Item animé en 3D
  function CarouselItem({ item, index }: { item: T; index: number }) {
    const style = useAnimatedStyle<ViewStyle>(() => {
      const pos = scrollX.value / totalItemWidth;
      const diff = index - pos;
      const translateX = diff * itemWidth * 0.75;
      const rotateY = diff * -30;
      const scale = interpolate(diff, [-1, 0, 1], [0.8, 1, 0.8], Extrapolate.CLAMP);
      return {
        transform: [
          { perspective: 2000 },
          { translateX },
          { rotateY: `${rotateY}deg` },
          { scale },
        ],
        zIndex: 100 - Math.abs(Math.round(diff)) * 10,
      } as ViewStyle;
    });

    return (
      <Animated.View
        style={[
          { width: itemWidth, marginHorizontal: spacing / 2 },
          style,
        ]}
      >
        {renderItem({ item, index })}
      </Animated.View>
    );
  }

  // Dot animé
  function Dot({ index }: { index: number }) {
    const style = useAnimatedStyle(() => {
      const pos = scrollX.value / totalItemWidth;
      const opacity = interpolate(
        pos,
        [index - 1, index, index + 1],
        [0.3, 1, 0.3],
        Extrapolate.CLAMP
      );
      return { opacity };
    });
    return (
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: dotColor },
          style,
        ]}
      />
    );
  }

  return (
    <View>
      <Animated.FlatList
        ref={listRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.98}
        snapToOffsets={snapOffsets}
        snapToAlignment="center"
        // disableIntervalMomentum active sur iOS pour un snap plus doux
        disableIntervalMomentum={Platform.OS === 'ios'}
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onMomentumScrollEnd={({ nativeEvent }) => {
          // recadrage final pour Android & iOS
          const offset = nativeEvent.contentOffset.x;
          const idx = Math.round(offset / totalItemWidth);
          listRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewPosition: 0.5,
          });
        }}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => (
          <CarouselItem item={item} index={index} />
        )}
        getItemLayout={(_, index) => ({
          length: totalItemWidth,
          offset: totalItemWidth * index,
          index,
        })}
      />

      <View style={styles.pagination}>
        {data.map((_, i) => (
          <Dot key={i} index={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginHorizontal: DOT_SPACING / 2,
  },
});
