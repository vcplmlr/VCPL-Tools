import { HttpErrorPage, HttpErrorPageProps } from './HttpErrorPage';

type NotFoundPageProps = HttpErrorPageProps;

export function NotFoundPage(props: NotFoundPageProps) {
  return <HttpErrorPage {...props} statusCode={props.statusCode ?? 404} />;
}
