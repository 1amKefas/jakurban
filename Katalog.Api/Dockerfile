# Stage 1: Build aplikasi ASP.NET Core
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Katalog.Api.csproj", "./"]
RUN dotnet restore "Katalog.Api.csproj"
COPY . .
RUN dotnet publish "Katalog.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime Image yang ringan
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

# Install the missing Kerberos/GSSAPI library required by the database driver
RUN apt-get update \
    && apt-get install -y libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

# Render otomatis menyediakan port melalui environment variable PORT (default 8080)
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Katalog.Api.dll"]