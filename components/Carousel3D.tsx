import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from "react-native";
import Carousel from "react-native-snap-carousel"; // ✅ Changement de lib
import { Card, Text } from "react-native-paper";

const { width } = Dimensions.get("window");
const ITEM_WIDTH = width * 0.75;
const ITEM_HEIGHT = 250;

export interface Challenge {
  id: string;
  title: string;
  category?: string;
  description?: string;
  imageUrl?: string;
}

interface CarouselProps {
  challenges: Challenge[];
  onChallengePress: (challenge: Challenge) => void;
}

const ChallengeCarousel: React.FC<CarouselProps> = ({
  challenges,
  onChallengePress,
}) => {
  return (
    <View style={styles.carouselContainer}>
      <Carousel
        data={challenges}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onChallengePress(item)}
            activeOpacity={0.9}
          >
            <View style={styles.itemContainer}>
              <Card style={styles.card}>
                <Image
                  source={{
                    uri:
                      item.imageUrl && item.imageUrl.startsWith("http")
                        ? item.imageUrl
                        : "https://your-domain.com/images/default.png",
                  }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <Card.Content>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.category}>{item.category}</Text>
                </Card.Content>
              </Card>
            </View>
          </TouchableOpacity>
        )}
        sliderWidth={width}
        itemWidth={ITEM_WIDTH}
        loop={true}
        autoplay={true}
        autoplayInterval={3500}
        inactiveSlideScale={0.85}
        inactiveSlideOpacity={0.6}
      />
    </View>
  );
};

export default ChallengeCarousel;

const styles = StyleSheet.create({
  carouselContainer: {
    marginVertical: 20,
    alignItems: "center",
  },
  itemContainer: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  card: {
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  cardImage: {
    width: "100%",
    height: 170,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 5,
    color: "#333",
  },
  category: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 5,
  },
});
