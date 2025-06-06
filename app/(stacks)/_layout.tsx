import { Stack } from "expo-router";

export default function StackLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: true,
            }}
        >
            <Stack.Screen options={{
                title: "Đăng nhập",
                headerStyle: {
                    backgroundColor: "#E8F5E8",
                },
                headerTintColor: "#00A86B",
            }} name="login" />
            <Stack.Screen
                options={{
                    title: "Đăng ký",
                    headerStyle: {
                        backgroundColor: "#E8F5E8",
                    },
                    headerTintColor: "#00A86B",
                }}
                name="register" />
        </Stack>
    );
}
