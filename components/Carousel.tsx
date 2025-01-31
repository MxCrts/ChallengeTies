import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Card } from "react-native-paper";
import Swiper from "react-native-swiper";

const { width } = Dimensions.get("window");

interface Challenge {
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

const Carousel: React.FC<CarouselProps> = ({
  challenges,
  onChallengePress,
}) => {
  return (
    <View style={styles.carouselContainer}>
      <Text style={styles.carouselTitle}>🔥 Popular Challenges</Text>

      <Swiper
        style={styles.swiper}
        autoplay
        autoplayTimeout={3}
        loop
        showsPagination
        dotStyle={styles.swiperDot}
        activeDotStyle={styles.swiperActiveDot}
      >
        {challenges.map((challenge) => (
          <TouchableOpacity
            key={challenge.id}
            onPress={() => onChallengePress(challenge)}
            style={styles.slide}
          >
            <Card style={styles.challengeCard}>
              <Card.Cover
                source={
                  challenge.imageUrl
                    ? { uri: challenge.imageUrl }
                    : require("../assets/images/default-challenge.webp") // ✅ Correction du chemin
                }
                style={styles.challengeImage}
              />
              <Card.Content>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeCategory}>
                  {challenge.category}
                </Text>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
      </Swiper>
    </View>
  );
};

export default Carousel;

const styles = StyleSheet.create({
  carouselContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  carouselTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 15,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  swiper: {
    height: 280, // ✅ Augmentation de la taille pour meilleure visibilité
  },
  swiperDot: {
    backgroundColor: "#FFF",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  swiperActiveDot: {
    backgroundColor: "#FF9800",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 3,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  challengeCard: {
    width: width * 0.85, // ✅ Un peu plus grand pour mieux remplir l'écran
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  challengeImage: {
    height: 180, // ✅ Agrandissement pour un rendu premium
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 10,
    textAlign: "center",
  },
  challengeCategory: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginBottom: 10,
  },
});
