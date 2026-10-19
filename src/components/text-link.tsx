import { Link, type Href } from 'expo-router';
import { Text } from 'react-native';

export function TextLink({
  href,
  label,
  replace,
}: {
  href: Href;
  label: string;
  replace?: boolean;
}) {
  return (
    <Link href={href} replace={replace} asChild>
      <Text accessibilityRole="link" className="font-semibold text-sm text-action underline">
        {label}
      </Text>
    </Link>
  );
}
