import { StyleSheet } from "react-native";

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 40,
  },
  title: {
    alignSelf: 'center',
    marginBottom: 30,
  },
  loaderContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 30,
    marginBottom: 20,
    minHeight: 50,
  },
  googleIcon: {
    width: 34,
    height: 34,
    marginRight: 10,
    borderRadius: 20,
  },
  googleIcon2: {
    width: 34,
    height: 34,
    marginRight: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  googleText: {
    fontSize: theme.fonts.sizes.regular,
    color: theme.colors.text,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    marginLeft: 5,
  },
});

export default createStyles;