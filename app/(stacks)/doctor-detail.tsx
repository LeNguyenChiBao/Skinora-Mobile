import { authService } from "@/services/authServices.service";
import { userService } from "@/services/user.service";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
  const [expandedDays, setExpandedDays] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [bookingStep, setBookingStep] = useState<"date" | "time" | "confirm">(
    "date"
  );
  const [availableDates, setAvailableDates] = useState<any[]>([]);

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

  const showBookingDialog = () => {
    if (!doctor?.isActive) {
      Alert.alert("Thông báo", "Bác sĩ hiện không hoạt động");
      return;
    }

    const dates = getAvailableDates();
    if (dates.length === 0) {
      Alert.alert(
        "Thông báo",
        "Bác sĩ hiện không có lịch trống trong tuần tới"
      );
      return;
    }

    setAvailableDates(dates);
    setBookingStep("date");
    setShowBookingModal(true);
  };

  const handleDateSelect = (date: any) => {
    setSelectedDate(date.date);
    setBookingStep("time");
  };

  const handleTimeSelect = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
    setBookingStep("confirm");
  };

  const resetBooking = () => {
    setSelectedDate("");
    setSelectedTimeSlot("");
    setBookingStep("date");
    setShowBookingModal(false);
  };

  const renderBookingModal = () => {
    const selectedDateData = availableDates.find((d) => d.date === selectedDate);

    return (
      <Modal
        visible={showBookingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={resetBooking}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {bookingStep === "date" && "Chọn ngày hẹn"}
                {bookingStep === "time" && "Chọn giờ hẹn"}
                {bookingStep === "confirm" && "Xác nhận đặt lịch"}
              </Text>
              <TouchableOpacity onPress={resetBooking}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {bookingStep === "date" && (
                <View>
                  <Text style={styles.modalSubtext}>
                    Vui lòng chọn ngày bạn muốn đặt lịch:
                  </Text>
                  {availableDates.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dateOption}
                      onPress={() => handleDateSelect(item)}
                    >
                      <Text style={styles.dateText}>{item.dayName}</Text>
                      <Text style={styles.dateSubtext}>{item.date}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {bookingStep === "time" && selectedDateData && (
                <View>
                  <Text style={styles.modalSubtext}>
                    Ngày: {selectedDateData.dayName} ({selectedDate})
                  </Text>
                  <Text style={styles.modalSubtext}>Vui lòng chọn giờ:</Text>
                  <View style={styles.timeSlotGrid}>
                    {selectedDateData.timeSlots.map(
                      (slot: string, index: number) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.timeSlotOption}
                          onPress={() => handleTimeSelect(slot)}
                        >
                          <Text style={styles.timeSlotText}>{slot}</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>
              )}

              {bookingStep === "confirm" && (
                <View>
                  <View style={styles.confirmDetails}>
                    <Text style={styles.confirmLabel}>Bác sĩ:</Text>
                    <Text style={styles.confirmValue}>{doctor?.fullName}</Text>
                  </View>
                  <View style={styles.confirmDetails}>
                    <Text style={styles.confirmLabel}>Ngày:</Text>
                    <Text style={styles.confirmValue}>{selectedDate}</Text>
                  </View>
                  <View style={styles.confirmDetails}>
                    <Text style={styles.confirmLabel}>Giờ:</Text>
                    <Text style={styles.confirmValue}>{selectedTimeSlot}</Text>
                  </View>
                  <Text style={styles.confirmQuestion}>
                    Bạn có chắc chắn muốn đặt lịch hẹn này?
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              {bookingStep === "time" && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setBookingStep("date")}
                >
                  <Text style={styles.backButtonText}>Quay lại</Text>
                </TouchableOpacity>
              )}
              {bookingStep === "confirm" && (
                <>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={resetBooking}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleBookAppointment}
                  >
                    <Text style={styles.confirmButtonText}>Xác nhận</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const handleBookAppointment = async () => {
    try {
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
                setBookingStep("date");
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

  const toggleDayExpansion = (day: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Chi tiết bác sĩ",
            headerStyle: {
              backgroundColor: "#E8F5E8",
            },
            headerTintColor: "#00A86B",
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00A86B" />
            <Text style={styles.loadingText}>Đang tải thông tin bác sĩ...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!doctor) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Chi tiết bác sĩ",
            headerStyle: {
              backgroundColor: "#E8F5E8",
            },
            headerTintColor: "#00A86B",
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        />
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Không tìm thấy thông tin bác sĩ</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Chi tiết bác sĩ",
          headerStyle: {
            backgroundColor: "#E8F5E8",
          },
          headerTintColor: "#00A86B",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          headerRight: () => (
            <TouchableOpacity style={styles.headerShareButton}>
              <Ionicons name="share-outline" size={24} color="#00A86B" />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Doctor Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <Image
                source={{
                  uri: doctor.photoUrl || "https://via.placeholder.com/120",
                }}
                style={styles.avatar}
              />
              {doctor.isActive && <View style={styles.onlineIndicator} />}
            </View>

            <Text style={styles.doctorName}>{doctor.fullName}</Text>
            <Text style={styles.specialty}>
              {getSpecialtyText(doctor.specializations)}
            </Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  doctor.isActive ? styles.activeBadge : styles.inactiveBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    doctor.isActive ? styles.activeText : styles.inactiveText,
                  ]}
                >
                  {doctor.isActive ? "Đang hoạt động" : "Không hoạt động"}
                </Text>
              </View>

              {doctor.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#00A86B" />
                  <Text style={styles.verifiedText}>Đã xác minh</Text>
                </View>
              )}
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin liên hệ</Text>

            <View style={styles.contactItem}>
              <Ionicons name="call" size={20} color="#00A86B" />
              <Text style={styles.contactText}>{doctor.phone}</Text>
            </View>

            <View style={styles.contactItem}>
              <Ionicons name="mail" size={20} color="#00A86B" />
              <Text style={styles.contactText}>{doctor.email}</Text>
            </View>

            <View style={styles.contactItem}>
              <Ionicons name="location" size={20} color="#00A86B" />
              <Text style={styles.contactText}>{doctor.address}</Text>
            </View>
          </View>

          {/* Availability Schedule */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lịch làm việc</Text>

            {Object.entries(doctor.availability).map(([day, availability]) => (
              <View key={day} style={styles.scheduleItem}>
                <TouchableOpacity
                  style={styles.scheduleHeader}
                  onPress={() => toggleDayExpansion(day)}
                  activeOpacity={0.8}
                >
                  <View style={styles.dayInfo}>
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
                    <Ionicons
                      name={expandedDays[day] ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#666"
                    />
                  )}
                </TouchableOpacity>

                {availability.isAvailable && expandedDays[day] && (
                  <View style={styles.timeSlotsContainer}>
                    <View style={styles.timeChipsWrapper}>
                      {availability.timeSlots.map((timeSlot, index) => (
                        <View key={index} style={styles.timeChip}>
                          <Text style={styles.timeChipText}>{timeSlot}</Text>
                        </View>
                      ))}
                    </View>
                    {availability.timeSlots.length === 0 && (
                      <Text style={styles.noSlotsText}>Không có khung giờ</Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={{ marginBottom: 100 }} />
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.chatButton} activeOpacity={0.8}>
            <Ionicons name="chatbubble-outline" size={20} color="#00A86B" />
            <Text style={styles.chatButtonText}>Nhắn tin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bookButton,
              !doctor?.isActive && styles.disabledButton,
            ]}
            onPress={showBookingDialog}
            disabled={!doctor?.isActive}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar" size={20} color="#FFFFFF" />
            <Text style={styles.bookButtonText}>Đặt lịch</Text>
          </TouchableOpacity>
        </View>

        {renderBookingModal()}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
  },
  headerShareButton: {
    marginRight: 16,
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
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
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
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
    backgroundColor: "#00A86B",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  doctorName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  specialty: {
    fontSize: 16,
    color: "#00A86B",
    marginBottom: 16,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
    color: "#00A86B",
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
    color: "#00A86B",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
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
  scheduleItem: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: "#F8F9FA",
    overflow: "hidden",
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  dayInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginRight: 12,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
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
    color: "#00A86B",
  },
  unavailableText: {
    color: "#F44336",
  },
  timeSlotsContainer: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: "#FFFFFF",
  },
  timeChipsWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeChip: {
    backgroundColor: "#E8F5E8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  timeChipText: {
    fontSize: 12,
    color: "#00A86B",
    fontWeight: "500",
  },
  noSlotsText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    gap: 12,
  },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#00A86B",
    gap: 8,
  },
  chatButtonText: {
    color: "#00A86B",
    fontSize: 16,
    fontWeight: "600",
  },
  bookButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00A86B",
    paddingVertical: 16,
    borderRadius: 100,
    gap: 8,
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#A0C4A7",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  modalSubtext: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  dateOption: {
    backgroundColor: "#E8F5E8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  dateSubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  timeSlotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  timeSlotOption: {
    backgroundColor: "#E8F5E8",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#00A86B",
  },
  timeSlotText: {
    fontSize: 14,
    color: "#00A86B",
    fontWeight: "500",
  },
  confirmDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  confirmLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  confirmValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  confirmQuestion: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  backButton: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingVertical: 12,
    borderRadius: 100,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  backButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    paddingVertical: 12,
    borderRadius: 100,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#00A86B",
    paddingVertical: 12,
    borderRadius: 100,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
