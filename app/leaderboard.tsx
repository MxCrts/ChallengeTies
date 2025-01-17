import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Image,
    TouchableOpacity,
    Dimensions,
} from "react-native";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

interface LeaderboardEntry {
    id: string;
    name: string;
    profileImage: string;
    points: number;
}

export default function Leaderboard() {
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
        []
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            setLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "leaderboard"));
                const data = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    name: doc.data().name || "Anonymous",
                    profileImage: doc.data().profileImage || "",
                    points: doc.data().points || 0,
                })) as LeaderboardEntry[];
                setLeaderboardData(
                    data.sort((a, b) => b.points - a.points) // Sort by points descending
                );
            } catch (error) {
                console.error("Error fetching leaderboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboardData();
    }, []);

    const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => (
        <View style={[styles.entryContainer, index === 0 && styles.topEntry]}>
            <Image
                source={
                    item.profileImage
                        ? { uri: item.profileImage }
                        : require("../public/images/default-profile.webp")
                }
                style={styles.profileImage}
            />
            <View style={styles.infoContainer}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.points}>{item.points} points</Text>
            </View>
            {index === 0 && <Text style={styles.firstPlaceBadge}>🥇</Text>}
            {index === 1 && <Text style={styles.secondPlaceBadge}>🥈</Text>}
            {index === 2 && <Text style={styles.thirdPlaceBadge}>🥉</Text>}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF9800" />
                <Text style={styles.loadingText}>Loading leaderboard...</Text>
            </View>
        );
    }

    return (
        <LinearGradient colors={["#FF9800", "#FF5722"]} style={styles.container}>
            <Text style={styles.header}>Leaderboard</Text>
            <FlatList
                data={leaderboardData}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#FFF",
        textAlign: "center",
        marginBottom: 20,
    },
    listContainer: {
        paddingBottom: 20,
    },
    entryContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        marginBottom: 10,
        padding: 15,
        borderRadius: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    topEntry: {
        backgroundColor: "#FFD700",
    },
    profileImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    infoContainer: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    points: {
        fontSize: 14,
        color: "#888",
    },
    firstPlaceBadge: {
        fontSize: 18,
        color: "#FFD700",
        fontWeight: "bold",
    },
    secondPlaceBadge: {
        fontSize: 18,
        color: "#C0C0C0",
        fontWeight: "bold",
    },
    thirdPlaceBadge: {
        fontSize: 18,
        color: "#CD7F32",
        fontWeight: "bold",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: "#FFF",
    },
});
