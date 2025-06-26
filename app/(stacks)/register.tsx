import { authService } from "@/services/authServices.service";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const router = useRouter();
  // Vietnamese provinces and cities (short list for demo, expand as needed)
  const provinces = [
    {
      name: "Hà Nội",
      cities: [
        "Ba Đình",
        "Hoàn Kiếm",
        "Tây Hồ",
        "Long Biên",
        "Cầu Giấy",
        "Đống Đa",
        "Hai Bà Trưng",
        "Hoàng Mai",
        "Thanh Xuân",
      ],
    },
    {
      name: "Hồ Chí Minh",
      cities: [
        "Quận 1",
        "Quận 2",
        "Quận 3",
        "Quận 4",
        "Quận 5",
        "Quận 6",
        "Quận 7",
        "Quận 8",
        "Quận 9",
        "Quận 10",
        "Quận 11",
        "Quận 12",
        "Bình Thạnh",
        "Gò Vấp",
        "Phú Nhuận",
        "Tân Bình",
        "Tân Phú",
        "Thủ Đức",
      ],
    },
    {
      name: "Đà Nẵng",
      cities: [
        "Hải Châu",
        "Thanh Khê",
        "Sơn Trà",
        "Ngũ Hành Sơn",
        "Liên Chiểu",
        "Cẩm Lệ",
        "Hòa Vang",
      ],
    },
    {
      name: "Hải Phòng",
      cities: [
        "Hồng Bàng",
        "Lê Chân",
        "Ngô Quyền",
        "Kiến An",
        "Hải An",
        "Dương Kinh",
        "Đồ Sơn",
      ],
    },
    {
      name: "Cần Thơ",
      cities: [
        "Ninh Kiều",
        "Bình Thủy",
        "Cái Răng",
        "Ô Môn",
        "Thốt Nốt",
        "Phong Điền",
        "Cờ Đỏ",
      ],
    },
  ];

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    dob: "",
    streetAddress: "",
    province: "",
    city: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);

  // Get cities for selected province
  const selectedProvince = provinces.find((p) => p.name === form.province);
  const cities = selectedProvince ? selectedProvince.cities : [];

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "province") {
      setForm((prev) => ({ ...prev, city: "" }));
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      // Format as YYYY-MM-DD
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate.getDate()).padStart(2, "0");
      handleChange("dob", `${yyyy}-${mm}-${dd}`);
    }
  };

  const handleRegister = async () => {
    // Basic validation
    if (
      !form.email ||
      !form.password ||
      !form.fullName ||
      !form.phone ||
      !form.dob ||
      !form.streetAddress ||
      !form.province ||
      !form.city
    ) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setIsLoading(true);
    try {
      // Combine address parts into a single string
      const fullAddress = `${form.streetAddress}, ${form.city}, ${form.province}`;

      const response = await authService.register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        dob: form.dob,
        address: fullAddress,
        avatarUrl: "https://example.com/jane-avatar.jpg",
      });
      if (response.success) {
        Alert.alert("Thành công", "Đăng ký thành công. Vui lòng đăng nhập.");
        router.replace("/(stacks)/login");
      } else {
        const errorMessage = Array.isArray(response.message)
          ? response.message.join("\n") // Join errors with a newline
          : response.message || "Đăng ký thất bại";
        Alert.alert("Lỗi", errorMessage);
      }
    } catch (error: any) {
      // Handle cases where the error from the catch block might be an object
      const errorMessage = error?.message || "Có lỗi xảy ra. Vui lòng thử lại.";
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8F5E8" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Đăng ký tài khoản</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập email"
              value={form.email}
              onChangeText={(v) => handleChange("email", v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              value={form.password}
              onChangeText={(v) => handleChange("password", v)}
              secureTextEntry
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Họ và tên</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập họ và tên"
              value={form.fullName}
              onChangeText={(v) => handleChange("fullName", v)}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập số điện thoại"
              value={form.phone}
              onChangeText={(v) => handleChange("phone", v)}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Ngày sinh</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ color: form.dob ? "#222" : "#999" }}>
                {form.dob ? form.dob : "Chọn ngày sinh"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Tỉnh/Thành phố</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={form.province}
                onValueChange={(v: string) => handleChange("province", v)}
                style={styles.picker}
              >
                <Picker.Item label="Chọn tỉnh/thành phố" value="" />
                {provinces.map((p) => (
                  <Picker.Item key={p.name} label={p.name} value={p.name} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Quận/Huyện/Thành phố</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={form.city}
                onValueChange={(v: string) => handleChange("city", v)}
                style={styles.picker}
                enabled={!!form.province}
              >
                <Picker.Item label="Chọn quận/huyện/thành phố" value="" />
                {cities.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Số nhà, tên đường</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập số nhà, tên đường"
              value={form.streetAddress}
              onChangeText={(v) => handleChange("streetAddress", v)}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.registerButton,
              isLoading && styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.registerButtonText}>Đăng ký</Text>
            )}
          </TouchableOpacity>
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.replace("/(stacks)/login")}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8F5E8",
    marginBottom: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 30,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00A86B",
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00A86L",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  registerButton: {
    backgroundColor: "#00A86B",
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  registerButtonDisabled: {
    backgroundColor: "#A0C4A7",
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  loginText: {
    color: "#666666",
    fontSize: 14,
  },
  loginLink: {
    color: "#26D0CE",
    fontSize: 14,
    fontWeight: "600",
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  picker: {
    width: "100%",
    color: "#222",
  },
});
