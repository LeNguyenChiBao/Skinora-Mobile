import { authService } from "@/services/authServices.service";
import { userService } from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface DayAvailability {
  isAvailable: boolean;
  timeRanges: Array<{
    start: string;
    end: string;
  }>;
  timeSlots: string[];
}

interface Doctor {
  _id: string;
  email: string;
  fullName: string;
  phone: string;
  address: string;
  photoUrl: string;
  specializations: string[];
  availability: {
    monday: DayAvailability;
    tuesday: DayAvailability;
    wednesday: DayAvailability;
    thursday: DayAvailability;
    friday: DayAvailability;
    saturday: DayAvailability;
    sunday: DayAvailability;
  };
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function DoctorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDoctorDetails(id as string);
    }
  }, [id]);

  const fetchDoctorDetails = async (doctorId: string) => {
    try {
      setLoading(true);
      const response = await userService.getDoctorById(doctorId);

      if (response.success) {
        setDoctor(response.data);
      } else {
        Alert.alert("Lỗi", "Không thể tải thông tin bác sĩ");
      }
    } catch (error) {
      console.error("Error fetching doctor details:", error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = async () => {
    try {
      // Get current user data
      const userData = await authService.getUserData();
      if (!userData?.id) {
        Alert.alert("Lỗi", "Vui lòng đăng nhập để đặt lịch hẹn");
        return;
      }

      if (!selectedDate || !selectedTimeSlot) {
        Alert.alert("Lỗi", "Vui lòng chọn ngày và giờ hẹn");
        return;
      }

      const appointmentData = {
        doctorId: doctor!._id,
        userId: userData.id,
        date: selectedDate,
        timeSlot: selectedTimeSlot,
      };

      const response = await userService.createAppointment(appointmentData);

      if (response.success) {
        Alert.alert(
          "Thành công",
          "Đặt lịch hẹn thành công! Bác sĩ sẽ liên hệ với bạn sớm.",
          [
            {
              text: "OK",
              onPress: () => {
                setShowBookingModal(false);
                setSelectedDate("");
                setSelectedTimeSlot("");
              },
            },
          ]
        );
      } else {
        Alert.alert("Lỗi", response.message || "Không thể đặt lịch hẹn");
      }
    } catch (error) {
      console.error("Error booking appointment:", error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ");
    }
  };

  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();

    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dayName = Object.keys(doctor!.availability)[
        date.getDay() === 0 ? 6 : date.getDay() - 1
      ];
      const dayAvailability =
        doctor!.availability[dayName as keyof typeof doctor.availability];

      if (dayAvailability.isAvailable) {
        dates.push({
          date: date.toISOString().split("T")[0],
          dayName: getDayName(dayName),
          timeSlots: dayAvailability.timeSlots,
        });
      }
    }

    return dates;
  };

  const showBookingDialog = () => {
    if (!doctor?.isActive) {
      Alert.alert("Thông báo", "Bác sĩ hiện không hoạt động");
      return;
    }

    const availableDates = getAvailableDates();
    if (availableDates.length === 0) {
      Alert.alert(
        "Thông báo",
        "Bác sĩ hiện không có lịch trống trong tuần tới"
      );
      return;
    }

    // Show date selection
    const dateOptions = availableDates.map((item) => ({
      text: `${item.dayName} (${item.date})`,
      onPress: () => {
        setSelectedDate(item.date);
        showTimeSlotSelection(item.timeSlots);
      },
    }));

    Alert.alert("Chọn ngày hẹn", "Vui lòng chọn ngày bạn muốn đặt lịch:", [
      ...dateOptions,
      { text: "Hủy", style: "cancel" },
    ]);
  };

  const showTimeSlotSelection = (timeSlots: string[]) => {
    const timeOptions = timeSlots.map((slot) => ({
      text: slot,
      onPress: () => {
        setSelectedTimeSlot(slot);
        confirmBooking();
      },
    }));

    Alert.alert("Chọn giờ hẹn", `Ngày: ${selectedDate}\nVui lòng chọn giờ:`, [
      ...timeOptions,
      {
        text: "Quay lại",
        onPress: () => {
          setSelectedDate("");
          showBookingDialog();
        },
      },
    ]);
  };

  const confirmBooking = () => {
    Alert.alert(
      "Xác nhận đặt lịch",
      `Bác sĩ: ${
        doctor!.fullName
      }\nNgày: ${selectedDate}\nGiờ: ${selectedTimeSlot}\n\nBạn có chắc chắn muốn đặt lịch hẹn này?`,
      [
        { text: "Hủy", style: "cancel" },
        { text: "Xác nhận", onPress: handleBookAppointment },
      ]
    );
  };

  const getDayName = (day: string) => {
    const dayNames = {
      monday: "Thứ 2",
      tuesday: "Thứ 3",
      wednesday: "Thứ 4",
      thursday: "Thứ 5",
      friday: "Thứ 6",
      saturday: "Thứ 7",
      sunday: "Chủ nhật",
    };
    return dayNames[day as keyof typeof dayNames] || day;
  };

  const getSpecialtyText = (specializations: string[]) => {
    if (specializations.length === 0) return "Bác sĩ đa khoa";
    return specializations.join(", ");
  };

  const formatTimeSlots = (timeSlots: string[]) => {
    if (timeSlots.length === 0) return "Không có lịch";
    return timeSlots.join(" • ");
  };

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
              <Ionicons name="arrow-back" size={24} color="#00A86L" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chi tiết bác sĩ</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00A86L" />
            <Text style={styles.loadingText}>Đang tải thông tin bác sĩ...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!doctor) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#00A86L" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chi tiết bác sĩ</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Không tìm thấy thông tin bác sĩ
            </Text>
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
            <Ionicons name="arrow-back" size={24} color="#00A86L" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết bác sĩ</Text>
          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color="#00A86L" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Doctor Profile */}
          <View style={styles.profileSection}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri: doctor.photoUrl || "https://via.placeholder.com/120",
                  }}
                  style={styles.avatar}
                />
                {doctor.isActive && <View style={styles.onlineIndicator} />}
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.doctorName}>{doctor.fullName}</Text>
                <Text style={styles.specialty}>
                  {getSpecialtyText(doctor.specializations)}
                </Text>

                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusBadge,
                      doctor.isActive
                        ? styles.activeBadge
                        : styles.inactiveBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        doctor.isActive
                          ? styles.activeText
                          : styles.inactiveText,
                      ]}
                    >
                      {doctor.isActive ? "Đang hoạt động" : "Không hoạt động"}
                    </Text>
                  </View>

                  {doctor.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#4CAF50"
                      />
                      <Text style={styles.verifiedText}>Đã xác minh</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>

            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color="#00A86L" />
              <Text style={styles.contactText}>{doctor.phone}</Text>
              <TouchableOpacity style={styles.contactAction}>
                <Ionicons name="call-outline" size={18} color="#00A86L" />
              </TouchableOpacity>
            </View>

            <View style={styles.contactItem}>
              <Ionicons name="mail" size={20} color="#00A86L" />
              <Text style={styles.contactText}>{doctor.email}</Text>
              <TouchableOpacity style={styles.contactAction}>
                <Ionicons name="mail-outline" size={18} color="#00A86L" />
              </TouchableOpacity>
            </View>

            <View style={styles.contactItem}>
              <Ionicons name="location" size={20} color="#00A86L" />
              <Text style={styles.contactText}>{doctor.address}</Text>
              <TouchableOpacity style={styles.contactAction}>
                <Ionicons name="map-outline" size={18} color="#00A86L" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Availability Schedule */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lịch làm việc</Text>

            {Object.entries(doctor.availability).map(([day, availability]) => (
              <View key={day} style={styles.scheduleItem}>
                <View style={styles.scheduleHeader}>
                  <Text style={styles.dayName}>{getDayName(day)}</Text>
                  <View
                    style={[
                      styles.availabilityBadge,
                      availability.isAvailable
                        ? styles.availableBadge
                        : styles.unavailableBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.availabilityText,
                        availability.isAvailable
                          ? styles.availableText
                          : styles.unavailableText,
                      ]}
                    >
                      {availability.isAvailable ? "Có lịch" : "Nghỉ"}
                    </Text>
                  </View>
                </View>

                {availability.isAvailable && (
                  <View style={styles.timeSlots}>
                    <Text style={styles.timeSlotsText}>
                      {formatTimeSlots(availability.timeSlots)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={{ marginBottom: 100 }} />
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.chatButton}>
            <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
            <Text style={styles.chatButtonText}>Nhắn tin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bookButton,
              !doctor?.isActive && styles.disabledButton,
            ]}
            onPress={showBookingDialog}
            disabled={!doctor?.isActive}
          >
            <Ionicons name="calendar" size={20} color="#FFFFFF" />
            <Text style={styles.bookButtonText}>Đặt lịch</Text>
          </TouchableOpacity>
        </View>
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
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
  },
  profileSection: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E0E0E0",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4CAF50",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  specialty: {
    fontSize: 16,
    color: "#00A86L",
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: "#E8F5E8",
  },
  inactiveBadge: {
    backgroundColor: "#FFE8E8",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  activeText: {
    color: "#4CAF50",
  },
  inactiveText: {
    color: "#F44336",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  contactText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  contactAction: {
    padding: 8,
  },
  scheduleItem: {
    marginBottom: 16,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadge: {
    backgroundColor: "#E8F5E8",
  },
  unavailableBadge: {
    backgroundColor: "#FFE8E8",
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: "600",
  },
  availableText: {
    color: "#4CAF50",
  },
  unavailableText: {
    color: "#F44336",
  },
  timeSlots: {
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
  },
  timeSlotsText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 12,
  },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00A86L",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  chatButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  bookButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#CCCCCC",
  },
});
