import { userService } from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Doctor {
  _id: string;
  fullName: string;
  specializations: string[];
  photoUrl: string;
  phone: string;
  address: string;
  isActive: boolean;
}

export default function DoctorsListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await userService.getDoctors();

      if (response.success) {
        setDoctors(response.data);
      } else {
        Alert.alert("Lỗi", "Không thể tải danh sách bác sĩ");
      }
    } catch (error) {
      console.error("Error fetching doctors:", error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(
    (doctor) =>
      doctor.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctor.specializations.some((spec) =>
        spec.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const getSpecialtyText = (specializations: string[]) => {
    if (specializations.length === 0) return "Bác sĩ đa khoa";
    return specializations.join(", ");
  };

  const renderDoctor = ({ item }: { item: Doctor }) => (
    <TouchableOpacity
      style={styles.doctorCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/(stacks)/doctor-detail?id=${item._id}`)}
    >
      <View style={styles.doctorInfo}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: item.photoUrl || "https://via.placeholder.com/100" }}
            style={styles.avatar}
          />
          {item.isActive && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.doctorDetails}>
          <View style={styles.doctorHeader}>
            <Text style={styles.doctorName}>{item.fullName}</Text>
            <TouchableOpacity style={styles.chatButton}>
              <Ionicons name="chatbubble-outline" size={20} color="#00A86B" />
            </TouchableOpacity>
          </View>

          <Text style={styles.specialty}>
            {getSpecialtyText(item.specializations)}
          </Text>

          <View style={styles.contactInfo}>
            <Ionicons name="call-outline" size={14} color="#666" />
            <Text style={styles.contactText}>{item.phone}</Text>
          </View>

          <View style={styles.contactInfo}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.contactText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#00A86B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bác sĩ da liễu</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00A86B" />
            <Text style={styles.loadingText}>Đang tải danh sách bác sĩ...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#00A86B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bác sĩ da liễu</Text>
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search" size={24} color="#00A86B" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#8E8E93"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm bác sĩ..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8E8E93"
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Danh sách bác sĩ ({filteredDoctors.length})
          </Text>
          <TouchableOpacity onPress={fetchDoctors}>
            <Ionicons name="refresh" size={20} color="#00A86B" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredDoctors}
          renderItem={renderDoctor}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchDoctors}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  searchButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  doctorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doctorInfo: {
    flexDirection: "row",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E0E0E0",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 50,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  doctorDetails: {
    flex: 1,
  },
  doctorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  chatButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
  },
  specialty: {
    fontSize: 14,
    color: "#00A86B",
    marginBottom: 8,
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  contactText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
    flex: 1,
  },
});
